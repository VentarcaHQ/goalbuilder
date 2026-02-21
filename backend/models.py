"""
Pydantic request and response models.
These define exactly what the frontend sends and what the backend returns.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional
from enum import Enum


class Country(str, Enum):
    US = "US"
    UK = "UK"
    EU = "EU"
    NG = "NG"


class RiskProfile(str, Enum):
    conservative = "conservative"
    balanced = "balanced"
    growth = "growth"
    aggressive = "aggressive"


class AssetType(str, Enum):
    equities = "equities"
    bonds = "bonds"
    mixed = "mixed"           # Uses the risk_profile allocation split


# ─── Compute request ──────────────────────────────────────────────────────────

class ComputeRequest(BaseModel):
    # Goal
    goal_name: str = Field(..., min_length=1, max_length=100)
    goal_value: float = Field(..., gt=0, description="Target amount in local currency")
    existing_savings: float = Field(0.0, ge=0, description="Amount already saved toward this goal")
    time_horizon_years: int = Field(..., ge=1, le=50)

    # Location & market
    country: Country
    asset_type: AssetType = AssetType.mixed
    risk_profile: RiskProfile = RiskProfile.balanced

    # Budget (used for surplus calculation)
    monthly_income: float = Field(..., gt=0)
    monthly_expenses: float = Field(..., ge=0)

    # Optional override
    inflation_rate_override: Optional[float] = Field(None, ge=0, le=1)

    @field_validator("monthly_expenses")
    @classmethod
    def expenses_less_than_income(cls, v, info):
        income = info.data.get("monthly_income", 0)
        if v >= income:
            raise ValueError("Monthly expenses must be less than monthly income")
        return v


# ─── Compute response ─────────────────────────────────────────────────────────

class PercentilePoint(BaseModel):
    month: int
    p10: float
    p50: float
    p90: float


class ComputeResponse(BaseModel):
    report_uuid: str

    # Core numbers
    required_monthly_savings: float
    inflation_adjusted_goal_value: float
    probability_of_success: float           # 0–100
    surplus_after_savings: float            # monthly_income - monthly_expenses - required_monthly_savings

    # Percentile outcomes at final month
    final_p10: float
    final_p50: float
    final_p90: float

    # Chart data — portfolio value at each month for 10th / 50th / 90th percentile
    # Sampled every 3 months to keep payload small
    chart_data: list[PercentilePoint]

    # Meta
    country: str
    currency: str
    currency_symbol: str
    time_horizon_months: int
    blended_annual_return: float
    inflation_rate: float
    risk_profile: str

    # Rate limit context — frontend uses this to decide whether to show paywall
    reports_used_today: int
    free_reports_limit: int


# ─── Newsletter subscribe request ─────────────────────────────────────────────

class SubscribeRequest(BaseModel):
    email: str = Field(..., pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    country: Optional[str] = None
    report_uuid: str


# ─── Payment ──────────────────────────────────────────────────────────────────

class CreatePaymentRequest(BaseModel):
    ip_hash: str        # Frontend passes the hash it received from the server
    report_uuid: str    # The report to unlock


class VerifyPaymentRequest(BaseModel):
    stripe_session_id: str
    report_uuid: str
