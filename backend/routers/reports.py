"""
Report-related endpoints:

  GET  /report/{uuid}/pdf      — download the PDF (triggers coffee + newsletter modal on frontend)
  POST /report/{uuid}/subscribe — newsletter opt-in
  POST /payment/create          — create a Stripe checkout session ($3)
  POST /payment/verify          — verify Stripe payment and unlock a paid report slot
  GET  /admin/stats             — usage analytics (requires ADMIN_API_KEY header)
  GET  /admin/subscribers       — CSV export of subscriber list
"""
import csv
import io
import stripe
from fastapi import APIRouter, HTTPException, Header, Request
from fastapi.responses import Response, StreamingResponse
from models import SubscribeRequest, CreatePaymentRequest, VerifyPaymentRequest
from database import (
    mark_report_downloaded, insert_subscriber,
    get_admin_stats, increment_paid_count, mark_report_paid,
    get_today_usage, db
)
from pdf_generator import generate_pdf
from config import settings, BENCHMARK_DATA, CURRENCY_SYMBOLS
from rate_limiter import get_client_ip, hash_ip

router = APIRouter()

stripe.api_key = settings.STRIPE_SECRET_KEY


# ─── PDF download ──────────────────────────────────────────────────────────────

@router.post("/report/{report_uuid}/pdf")
async def download_pdf(report_uuid: str, body: dict, request: Request):
    """
    Generate and stream the PDF for a given UUID.

    The frontend must pass the full simulation result in the request body
    (it stored it in sessionStorage after /compute returned).
    This avoids re-running the simulation and keeps the backend stateless.
    """
    if not body.get("goal_name"):
        raise HTTPException(status_code=400, detail="Missing simulation data")

    # Attach goal_value for the PDF (comes from frontend state)
    body["goal_value"] = body.get("goal_value", 0)

    pdf_bytes = generate_pdf(report_uuid=report_uuid, data=body)
    mark_report_downloaded(report_uuid)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="goalbuilder-{report_uuid[:8]}.pdf"'
        }
    )


# ─── Newsletter opt-in ─────────────────────────────────────────────────────────

@router.post("/report/{report_uuid}/subscribe")
async def subscribe(report_uuid: str, payload: SubscribeRequest):
    """
    Save the user's email to the subscribers table and optionally sync to Mailchimp.
    Always returns 200 — even if already subscribed — to avoid leaking whether
    an email is on the list.
    """
    is_new = insert_subscriber(email=payload.email, country=payload.country)

    if is_new and settings.MAILCHIMP_API_KEY:
        _sync_to_mailchimp(payload.email, payload.country)

    return {"subscribed": True, "is_new": is_new}


def _sync_to_mailchimp(email: str, country: str | None):
    """Best-effort Mailchimp sync — errors are silently logged, not raised."""
    try:
        import mailchimp_marketing as MailchimpMarketing
        client = MailchimpMarketing.Client()
        client.set_config({
            "api_key": settings.MAILCHIMP_API_KEY,
            "server": settings.MAILCHIMP_SERVER_PREFIX,
        })
        member = {
            "email_address": email,
            "status": "subscribed",
            "merge_fields": {"COUNTRY": country or ""},
        }
        client.lists.add_list_member(settings.MAILCHIMP_LIST_ID, member)
    except Exception as e:
        print(f"[Mailchimp] Sync failed for {email}: {e}")


# ─── Stripe payment ────────────────────────────────────────────────────────────

@router.post("/payment/create")
async def create_payment(payload: CreatePaymentRequest):
    """
    Create a Stripe Checkout session for a $3 one-time payment.
    Returns the Stripe-hosted checkout URL — frontend redirects the user there.
    """
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payment not configured")

    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{
            "price": settings.STRIPE_PRICE_ID,
            "quantity": 1,
        }],
        mode="payment",
        success_url=(
            f"{settings.FRONTEND_URL}/payment/success"
            f"?session_id={{CHECKOUT_SESSION_ID}}&uuid={payload.report_uuid}"
        ),
        cancel_url=f"{settings.FRONTEND_URL}/compute",
        metadata={
            "ip_hash": payload.ip_hash,
            "report_uuid": payload.report_uuid,
        }
    )
    return {"checkout_url": session.url}


@router.post("/payment/verify")
async def verify_payment(payload: VerifyPaymentRequest, request: Request):
    """
    Called after Stripe redirects back to /payment/success.
    Verifies the session is paid, then grants one additional report slot.
    """
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payment not configured")

    try:
        session = stripe.checkout.Session.retrieve(payload.stripe_session_id)
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if session.payment_status != "paid":
        raise HTTPException(status_code=402, detail="Payment not completed")

    ip_hash = session.metadata.get("ip_hash")
    if not ip_hash:
        raise HTTPException(status_code=400, detail="Missing metadata")

    # Mark report as paid and grant an extra slot for today
    mark_report_paid(payload.report_uuid, payload.stripe_session_id)
    increment_paid_count(ip_hash)

    return {"unlocked": True, "report_uuid": payload.report_uuid}


# ─── Admin ─────────────────────────────────────────────────────────────────────

def _require_admin(x_admin_key: str | None):
    if not x_admin_key or x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/admin/stats")
async def admin_stats(x_admin_key: str | None = Header(default=None)):
    """
    Returns usage analytics. Requires X-Admin-Key header.

    Example queries these wrap:
      SELECT COUNT(*) FROM reports;
      SELECT country, COUNT(*) FROM reports GROUP BY country;
      SELECT COUNT(*) * 3 FROM reports WHERE paid = TRUE;
    """
    _require_admin(x_admin_key)
    return get_admin_stats()


@router.get("/admin/subscribers")
async def admin_subscribers(x_admin_key: str | None = Header(default=None)):
    """Returns CSV of all active subscribers."""
    _require_admin(x_admin_key)

    with db() as cur:
        cur.execute(
            "SELECT email, country, subscribed_at FROM subscribers WHERE active = TRUE ORDER BY subscribed_at DESC"
        )
        rows = cur.fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["email", "country", "subscribed_at"])
    for row in rows:
        writer.writerow([row["email"], row["country"], row["subscribed_at"]])

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=subscribers.csv"}
    )
