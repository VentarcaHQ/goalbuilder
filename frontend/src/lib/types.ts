// ─── API types ────────────────────────────────────────────────────────────────

export type Country = "US" | "UK" | "EU" | "NG";
export type RiskProfile = "conservative" | "balanced" | "growth" | "aggressive";
export type AssetType = "equities" | "bonds" | "mixed";

export interface ComputeRequest {
  goal_name: string;
  goal_value: number;
  existing_savings: number;
  time_horizon_years: number;
  country: Country;
  asset_type: AssetType;
  risk_profile: RiskProfile;
  monthly_income: number;
  monthly_expenses: number;
  inflation_rate_override?: number;
}

export interface ChartPoint {
  month: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface SimulationResult {
  report_uuid: string;

  // Core numbers
  required_monthly_savings: number;
  inflation_adjusted_goal_value: number;
  probability_of_success: number;
  surplus_after_savings: number;

  // Final percentile values
  final_p10: number;
  final_p50: number;
  final_p90: number;

  // Chart
  chart_data: ChartPoint[];

  // Meta
  country: string;
  currency: string;
  currency_symbol: string;
  time_horizon_months: number;
  blended_annual_return: number;
  inflation_rate: number;
  risk_profile: string;

  // Rate limit
  reports_used_today: number;
  free_reports_limit: number;
}

// Fields from the form that we need to pass to the PDF generator
export interface GoalFormData extends ComputeRequest {}

// Combined result stored in sessionStorage
export interface StoredSession {
  result: SimulationResult;
  form: GoalFormData;
}

export interface RateLimitError {
  code: "RATE_LIMIT_EXCEEDED";
  message: string;
  free_used: number;
  free_limit: number;
  ip_hash: string;
}
