"""
POST /compute — runs the simulation and returns results + a report UUID.

Flow:
  1. Check rate limit for this IP
  2. If over limit → return 402 with payment_required flag
  3. Run Monte Carlo simulation
  4. Generate UUID and persist to `reports` table
  5. Return all data (frontend stores it in sessionStorage for the results page)
"""
import uuid
from fastapi import APIRouter, Request, HTTPException
from models import ComputeRequest, ComputeResponse
from simulation import run_simulation
from rate_limiter import get_client_ip, hash_ip, check_rate_limit
from database import insert_report, increment_free_count, get_today_usage
from config import BENCHMARK_DATA, CURRENCY_SYMBOLS

router = APIRouter()


@router.post("/compute", response_model=ComputeResponse)
async def compute(payload: ComputeRequest, request: Request):
    # ── Rate limit check ──────────────────────────────────────────────────────
    client_ip = get_client_ip(request)
    ip_hash   = hash_ip(client_ip)
    limit     = check_rate_limit(ip_hash)

    if limit["requires_payment"]:
        raise HTTPException(
            status_code=402,
            detail={
                "code": "RATE_LIMIT_EXCEEDED",
                "message": "You have used your 2 free reports for today. Pay $3 to continue.",
                "free_used": limit["free_used"],
                "free_limit": limit["free_limit"],
                "ip_hash": ip_hash,    # Frontend passes this back for the payment flow
            }
        )

    # ── Run simulation ────────────────────────────────────────────────────────
    results = run_simulation(
        goal_value=payload.goal_value,
        existing_savings=payload.existing_savings,
        time_horizon_years=payload.time_horizon_years,
        country=payload.country.value,
        risk_profile=payload.risk_profile.value,
        asset_type=payload.asset_type.value,
        monthly_income=payload.monthly_income,
        monthly_expenses=payload.monthly_expenses,
        inflation_override=payload.inflation_rate_override,
    )

    # ── Persist report record ─────────────────────────────────────────────────
    report_uuid = str(uuid.uuid4())
    insert_report(
        uuid=report_uuid,
        country=payload.country.value,
        goal_name=payload.goal_name,
        ip_hash=ip_hash,
    )
    increment_free_count(ip_hash)

    # ── Build response ────────────────────────────────────────────────────────
    country_data = BENCHMARK_DATA[payload.country.value]
    usage_after  = get_today_usage(ip_hash)

    return ComputeResponse(
        report_uuid=report_uuid,

        required_monthly_savings=results["required_monthly_savings"],
        inflation_adjusted_goal_value=results["inflation_adjusted_goal_value"],
        probability_of_success=results["probability_of_success"],
        surplus_after_savings=results["surplus_after_savings"],

        final_p10=results["final_p10"],
        final_p50=results["final_p50"],
        final_p90=results["final_p90"],
        chart_data=results["chart_data"],

        country=payload.country.value,
        currency=country_data["currency"],
        currency_symbol=CURRENCY_SYMBOLS[country_data["currency"]],
        time_horizon_months=results["time_horizon_months"],
        blended_annual_return=results["blended_annual_return"],
        inflation_rate=results["inflation_rate"],
        risk_profile=payload.risk_profile.value,

        reports_used_today=usage_after["free_count"],
        free_reports_limit=2,
    )
