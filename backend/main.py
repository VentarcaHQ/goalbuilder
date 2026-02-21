"""
GoalBuilder — FastAPI backend entry point.

Start with:
  uvicorn main:app --reload --port 8000

API routes:
  POST /compute                    — run simulation, return results + UUID
  POST /report/{uuid}/pdf          — generate and stream the PDF
  POST /report/{uuid}/subscribe    — newsletter opt-in
  POST /payment/create             — Stripe checkout session
  POST /payment/verify             — verify Stripe payment
  GET  /admin/stats                — usage analytics (requires X-Admin-Key header)
  GET  /admin/subscribers          — CSV subscriber export
  GET  /health                     — uptime check
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers import compute, reports
from config import settings

app = FastAPI(
    title="GoalBuilder API",
    description="Investment goal planning tool — simulation engine and report generation.",
    version="1.0.0",
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
# In production, replace "*" with your actual frontend domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Routers ──────────────────────────────────────────────────────────────────
app.include_router(compute.router)
app.include_router(reports.router)

# ─── Startup ──────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    init_db()
    print("[GoalBuilder] API ready.")


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
