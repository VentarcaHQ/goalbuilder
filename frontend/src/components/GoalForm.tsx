"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { computeSimulation } from "@/lib/api";
import type { ComputeRequest, Country, RiskProfile, AssetType, StoredSession, RateLimitError } from "@/lib/types";
import PaywallModal from "./PaywallModal";

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = ["country", "goal", "budget", "allocation", "review"] as const;
type Step = (typeof STEPS)[number];

const COUNTRIES: { code: Country; label: string; flag: string; currency: string }[] = [
  { code: "US", label: "United States", flag: "US", currency: "USD" },
  { code: "UK", label: "United Kingdom", flag: "UK", currency: "GBP" },
  { code: "EU", label: "Eurozone",       flag: "EU", currency: "EUR" },
  { code: "NG", label: "Nigeria",        flag: "NG", currency: "NGN" },
];

const RISK_PROFILES: { id: RiskProfile; label: string; desc: string; split: string }[] = [
  { id: "conservative", label: "Conservative", desc: "Capital preservation. Lower returns, lower risk.", split: "80% bonds / 20% equities" },
  { id: "balanced",     label: "Balanced",     desc: "Moderate growth with downside protection.",       split: "60% bonds / 40% equities" },
  { id: "growth",       label: "Growth",       desc: "Higher long-term returns with volatility.",       split: "30% bonds / 70% equities" },
  { id: "aggressive",   label: "Aggressive",   desc: "Maximum growth. Best for long horizons.",         split: "10% bonds / 90% equities" },
];

// ─── Initial form state ───────────────────────────────────────────────────────

const DEFAULT_FORM: ComputeRequest = {
  goal_name: "",
  goal_value: 0,
  existing_savings: 0,
  time_horizon_years: 5,
  country: "US",
  asset_type: "mixed",
  risk_profile: "balanced",
  monthly_income: 0,
  monthly_expenses: 0,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-terminal-muted uppercase tracking-widest mb-1">{children}</p>;
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="mb-5">{children}</div>;
}

function TerminalInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full bg-terminal-bg border border-terminal-border px-3 py-2 text-terminal-white " +
        "focus:border-terminal-text outline-none transition-colors font-mono " +
        (props.className ?? "")
      }
    />
  );
}

function StepBreadcrumb({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-8 text-[11px]">
      {STEPS.map((s, i) => (
        <span key={s} className="flex items-center gap-2">
          <span className={i <= current ? "text-terminal-white" : "text-terminal-dim"}>
            {i < current ? "✓" : i === current ? ">" : "○"} {s.toUpperCase()}
          </span>
          {i < STEPS.length - 1 && <span className="text-terminal-dim">──</span>}
        </span>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GoalForm() {
  const router = useRouter();
  const [step, setStep] = useState<number>(0);
  const [form, setForm] = useState<ComputeRequest>(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywallData, setPaywallData] = useState<RateLimitError | null>(null);
  const [computing, setComputing] = useState(false);

  const update = (field: keyof ComputeRequest, value: unknown) =>
    setForm((f) => ({ ...f, [field]: value }));

  const next = () => { setError(null); setStep((s) => s + 1); };
  const back = () => { setError(null); setStep((s) => s - 1); };

  // ── Validate current step before proceeding ────────────────────────────────
  const validate = (): boolean => {
    if (step === 1) {
      if (!form.goal_name.trim()) { setError("Goal name is required."); return false; }
      if (form.goal_value <= 0)   { setError("Goal value must be greater than 0."); return false; }
      if (form.time_horizon_years < 1) { setError("Time horizon must be at least 1 year."); return false; }
    }
    if (step === 2) {
      if (form.monthly_income <= 0)  { setError("Monthly income is required."); return false; }
      if (form.monthly_expenses >= form.monthly_income) {
        setError("Expenses must be less than income."); return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (!validate()) return;
    if (step === STEPS.length - 2) {
      setStep(STEPS.length - 1); // Jump to review
    } else {
      next();
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true);
    setComputing(true);
    setError(null);

    try {
      const result = await computeSimulation(form);
      const session: StoredSession = { result, form };
      sessionStorage.setItem("gb_session", JSON.stringify(session));
      router.push(`/results/${result.report_uuid}`);
    } catch (err: unknown) {
      setComputing(false);
      if (
        typeof err === "object" &&
        err !== null &&
        "type" in err &&
        (err as { type: string }).type === "RATE_LIMIT"
      ) {
        setPaywallData((err as unknown as { type: string; detail: RateLimitError }).detail);
      } else {
        setError(err instanceof Error ? err.message : "An error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Computing overlay ──────────────────────────────────────────────────────
  if (computing) {
    return <ComputingScreen goalName={form.goal_name} />;
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-12">
      <StepBreadcrumb current={step} />

      {/* Step: Country */}
      {step === 0 && (
        <div className="fade-in">
          <SectionTitle>Select your market</SectionTitle>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {COUNTRIES.map((c) => (
              <button
                key={c.code}
                onClick={() => { update("country", c.code); next(); }}
                className={
                  "border p-4 text-left transition-all " +
                  (form.country === c.code
                    ? "border-terminal-white bg-terminal-surface text-terminal-white"
                    : "border-terminal-border text-terminal-text hover:border-terminal-dim")
                }
              >
                <div className="text-terminal-muted text-[10px] uppercase tracking-widest">{c.code}</div>
                <div className="mt-1 font-bold text-sm">{c.label}</div>
                <div className="text-terminal-muted text-[11px] mt-0.5">{c.currency}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: Goal */}
      {step === 1 && (
        <div className="fade-in">
          <SectionTitle>Define your goal</SectionTitle>
          <Field>
            <Label>Goal name</Label>
            <TerminalInput
              placeholder="e.g. House deposit, Kids university fund"
              value={form.goal_name}
              onChange={(e) => update("goal_name", e.target.value)}
            />
          </Field>
          <Field>
            <Label>Target amount (in your local currency)</Label>
            <TerminalInput
              type="number"
              placeholder="50000"
              min={1}
              value={form.goal_value || ""}
              onChange={(e) => update("goal_value", parseFloat(e.target.value) || 0)}
            />
          </Field>
          <Field>
            <Label>Existing savings toward this goal</Label>
            <TerminalInput
              type="number"
              placeholder="0  — leave blank if starting from zero"
              min={0}
              value={form.existing_savings || ""}
              onChange={(e) => update("existing_savings", parseFloat(e.target.value) || 0)}
            />
          </Field>
          <Field>
            <Label>Time horizon (years)</Label>
            <TerminalInput
              type="number"
              placeholder="5"
              min={1}
              max={50}
              value={form.time_horizon_years || ""}
              onChange={(e) => update("time_horizon_years", parseInt(e.target.value) || 0)}
            />
          </Field>
          <NavButtons onBack={back} onNext={handleNext} />
        </div>
      )}

      {/* Step: Budget */}
      {step === 2 && (
        <div className="fade-in">
          <SectionTitle>Your monthly budget</SectionTitle>
          <p className="text-terminal-muted text-[12px] mb-5">
            Used to calculate how much surplus you&apos;ll have after saving toward your goal.
          </p>
          <Field>
            <Label>Monthly take-home income</Label>
            <TerminalInput
              type="number"
              placeholder="3500"
              min={1}
              value={form.monthly_income || ""}
              onChange={(e) => update("monthly_income", parseFloat(e.target.value) || 0)}
            />
          </Field>
          <Field>
            <Label>Monthly expenses (rent, bills, food, etc.)</Label>
            <TerminalInput
              type="number"
              placeholder="2000"
              min={0}
              value={form.monthly_expenses || ""}
              onChange={(e) => update("monthly_expenses", parseFloat(e.target.value) || 0)}
            />
          </Field>
          <div className="border border-terminal-border bg-terminal-bg p-3 text-[12px] text-terminal-muted">
            <span className="text-terminal-text">Monthly disposable: </span>
            <span className="text-terminal-white font-bold">
              {form.monthly_income > 0 && form.monthly_expenses >= 0
                ? (form.monthly_income - form.monthly_expenses).toLocaleString()
                : "—"}
            </span>
          </div>
          <div className="mt-4" />
          <NavButtons onBack={back} onNext={handleNext} />
        </div>
      )}

      {/* Step: Allocation */}
      {step === 3 && (
        <div className="fade-in">
          <SectionTitle>Choose a risk profile</SectionTitle>
          <div className="mt-4 space-y-2">
            {RISK_PROFILES.map((p) => (
              <button
                key={p.id}
                onClick={() => update("risk_profile", p.id as RiskProfile)}
                className={
                  "w-full border p-4 text-left transition-all " +
                  (form.risk_profile === p.id
                    ? "border-terminal-white bg-terminal-surface"
                    : "border-terminal-border hover:border-terminal-dim")
                }
              >
                <div className="flex items-start justify-between">
                  <span className="font-bold text-sm text-terminal-white">{p.label}</span>
                  <span className="text-terminal-muted text-[11px]">{p.split}</span>
                </div>
                <p className="text-terminal-muted text-[12px] mt-1">{p.desc}</p>
              </button>
            ))}
          </div>
          <div className="mt-4" />
          <NavButtons onBack={back} onNext={handleNext} />
        </div>
      )}

      {/* Step: Review */}
      {step === 4 && (
        <div className="fade-in">
          <SectionTitle>Review & run simulation</SectionTitle>
          <div className="mt-4 border border-terminal-border divide-y divide-terminal-border">
            <ReviewRow label="Country"         value={form.country} />
            <ReviewRow label="Goal"            value={form.goal_name} />
            <ReviewRow label="Target"          value={form.goal_value.toLocaleString()} />
            <ReviewRow label="Existing savings" value={form.existing_savings.toLocaleString()} />
            <ReviewRow label="Time horizon"    value={`${form.time_horizon_years} years`} />
            <ReviewRow label="Monthly income"  value={form.monthly_income.toLocaleString()} />
            <ReviewRow label="Monthly expenses" value={form.monthly_expenses.toLocaleString()} />
            <ReviewRow label="Risk profile"    value={form.risk_profile} />
          </div>

          {error && (
            <p className="mt-4 text-chart-red text-[12px] border border-chart-red p-2">
              {"> "}{error}
            </p>
          )}

          <div className="mt-6 flex gap-3">
            <button onClick={back} className="btn">[ BACK ]</button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? "[ RUNNING... ]" : "[ RUN SIMULATION ]"}
            </button>
          </div>

          <p className="mt-4 text-[11px] text-terminal-muted text-center">
            Running 1,000 Monte Carlo simulations. Results in under 2 seconds.
          </p>
        </div>
      )}

      {error && step < 4 && (
        <p className="mt-3 text-chart-red text-[12px]">{"> "}{error}</p>
      )}

      {paywallData && (
        <PaywallModal data={paywallData} onClose={() => setPaywallData(null)} />
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <h2 className="text-terminal-white text-lg font-bold">{children}</h2>
      <div className="h-px bg-terminal-border mt-2" />
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-terminal-bg even:bg-terminal-surface">
      <span className="text-terminal-muted text-[12px] uppercase tracking-wider">{label}</span>
      <span className="text-terminal-white text-[13px] font-bold">{value}</span>
    </div>
  );
}

function NavButtons({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex gap-3 mt-6">
      <button onClick={onBack} className="btn">[ BACK ]</button>
      <button onClick={onNext} className="btn btn-primary flex-1">[ NEXT ]</button>
    </div>
  );
}

function ComputingScreen({ goalName }: { goalName: string }) {
  const lines = [
    `> goal: "${goalName}"`,
    "> Sampling 1,000 return paths...",
    "> Applying inflation adjustment...",
    "> Calculating PMT...",
    "> Computing percentile bands...",
    "> Building projection chart...",
    "> Generating report UUID...",
  ];
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-xl border border-terminal-border bg-terminal-surface p-8">
        <p className="text-terminal-white font-bold mb-6 text-sm">// RUNNING SIMULATION</p>
        <div className="space-y-1.5">
          {lines.map((line, i) => (
            <p
              key={i}
              className="text-terminal-muted text-[12px] fade-in"
              style={{ animationDelay: `${i * 0.18}s` }}
            >
              {line}
            </p>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-2">
          <span className="text-terminal-muted text-[11px]">processing</span>
          <span className="inline-block w-2 h-3 bg-terminal-white animate-blink" />
        </div>
      </div>
    </div>
  );
}
