"""
Monte Carlo simulation engine and PMT calculation.

Key formula:
  PMT = (FV - PV * (1+r)^n) * r / ((1+r)^n - 1)

  Where:
    FV = inflation-adjusted future goal value
    PV = existing savings
    r  = blended monthly portfolio return
    n  = number of months
"""
import numpy as np
from config import BENCHMARK_DATA, ALLOCATION_PROFILES


# ─── Return blending ──────────────────────────────────────────────────────────

def get_blended_monthly_return(country: str, risk_profile: str, asset_type: str):
    """
    Compute blended monthly mean and std based on asset type and risk profile.
    Returns (monthly_mean, monthly_std, annual_mean).
    """
    market = BENCHMARK_DATA[country]

    if asset_type == "equities":
        annual_mean = market["equities"]["annual_mean"]
        annual_std  = market["equities"]["annual_std"]

    elif asset_type == "bonds":
        annual_mean = market["bonds"]["annual_mean"]
        annual_std  = market["bonds"]["annual_std"]

    else:  # mixed — use the risk profile allocation
        alloc = ALLOCATION_PROFILES[risk_profile]
        eq = market["equities"]
        bd = market["bonds"]

        # Weighted average mean
        annual_mean = alloc["equities"] * eq["annual_mean"] + alloc["bonds"] * bd["annual_mean"]

        # Weighted std (simplified — ignores correlation; conservative approximation)
        annual_std = (
            alloc["equities"] * eq["annual_std"] + alloc["bonds"] * bd["annual_std"]
        )

    # Convert annual to monthly
    monthly_mean = (1 + annual_mean) ** (1 / 12) - 1
    monthly_std  = annual_std / np.sqrt(12)

    return monthly_mean, monthly_std, annual_mean


# ─── PMT calculation ──────────────────────────────────────────────────────────

def calculate_pmt(future_value: float, present_value: float, monthly_rate: float, n_months: int) -> float:
    """
    Required monthly contribution to reach FV from PV in n months at rate r.

    PMT = (FV - PV * (1+r)^n) * r / ((1+r)^n - 1)

    If monthly_rate is 0 (e.g., 0% return), falls back to simple linear calculation.
    """
    if monthly_rate == 0:
        return (future_value - present_value) / n_months

    growth_factor = (1 + monthly_rate) ** n_months
    pmt = (future_value - present_value * growth_factor) * monthly_rate / (growth_factor - 1)
    return max(pmt, 0.0)   # Negative PMT means existing savings alone are enough


# ─── Monte Carlo ──────────────────────────────────────────────────────────────

def run_monte_carlo(
    monthly_contribution: float,
    existing_savings: float,
    monthly_mean: float,
    monthly_std: float,
    n_months: int,
    n_simulations: int = 1000,
) -> np.ndarray:
    """
    Vectorized Monte Carlo simulation.

    Returns a 2D array of shape (n_simulations, n_months + 1) where each row
    is one simulated portfolio trajectory. Column 0 is the starting value.
    """
    # Random monthly returns for all simulations at once
    returns = np.random.normal(monthly_mean, monthly_std, (n_simulations, n_months))

    # Portfolio trajectory — shape (n_simulations, n_months + 1)
    portfolio = np.zeros((n_simulations, n_months + 1))
    portfolio[:, 0] = existing_savings

    for month in range(n_months):
        portfolio[:, month + 1] = (
            portfolio[:, month] * (1 + returns[:, month]) + monthly_contribution
        )

    return portfolio


# ─── Main entry point ─────────────────────────────────────────────────────────

def run_simulation(
    goal_value: float,
    existing_savings: float,
    time_horizon_years: int,
    country: str,
    risk_profile: str,
    asset_type: str,
    monthly_income: float,
    monthly_expenses: float,
    inflation_override: float | None = None,
) -> dict:
    """
    Full simulation pipeline. Returns all data needed for the report and charts.
    """
    n_months = time_horizon_years * 12
    market = BENCHMARK_DATA[country]

    # Use country's inflation rate unless the user overrides it
    inflation_rate = inflation_override if inflation_override is not None else market["inflation"]

    # Inflate the goal value to future money
    inflation_adjusted_goal = goal_value * (1 + inflation_rate) ** time_horizon_years

    # Get blended portfolio returns
    monthly_mean, monthly_std, annual_mean = get_blended_monthly_return(
        country, risk_profile, asset_type
    )

    # Required monthly savings (deterministic PMT)
    required_pmt = calculate_pmt(
        future_value=inflation_adjusted_goal,
        present_value=existing_savings,
        monthly_rate=monthly_mean,
        n_months=n_months,
    )

    # Surplus after savings
    surplus = monthly_income - monthly_expenses - required_pmt

    # Monte Carlo — 1000 simulations
    trajectories = run_monte_carlo(
        monthly_contribution=required_pmt,
        existing_savings=existing_savings,
        monthly_mean=monthly_mean,
        monthly_std=monthly_std,
        n_months=n_months,
    )

    # Final values (last column of each simulation)
    final_values = trajectories[:, -1]

    # Probability of success = % of simulations that hit the inflation-adjusted target
    probability_of_success = float(np.mean(final_values >= inflation_adjusted_goal) * 100)

    # Percentile outcomes at the final month
    final_p10 = float(np.percentile(final_values, 10))
    final_p50 = float(np.percentile(final_values, 50))
    final_p90 = float(np.percentile(final_values, 90))

    # Chart data — sample every 3 months (keeps payload small)
    sample_months = list(range(0, n_months + 1, max(1, n_months // 40)))
    if n_months not in sample_months:
        sample_months.append(n_months)

    chart_data = []
    for m in sample_months:
        col = trajectories[:, m]
        chart_data.append({
            "month": m,
            "p10": round(float(np.percentile(col, 10)), 2),
            "p50": round(float(np.percentile(col, 50)), 2),
            "p90": round(float(np.percentile(col, 90)), 2),
        })

    return {
        "required_monthly_savings": round(required_pmt, 2),
        "inflation_adjusted_goal_value": round(inflation_adjusted_goal, 2),
        "probability_of_success": round(probability_of_success, 1),
        "surplus_after_savings": round(surplus, 2),
        "final_p10": round(final_p10, 2),
        "final_p50": round(final_p50, 2),
        "final_p90": round(final_p90, 2),
        "chart_data": chart_data,
        "blended_annual_return": round(annual_mean, 4),
        "inflation_rate": round(inflation_rate, 4),
        "time_horizon_months": n_months,
    }
