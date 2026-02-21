"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { StoredSession } from "@/lib/types";
import MonteCarloChart from "@/components/MonteCarloChart";
import CoffeeModal from "@/components/CoffeeModal";

function fmt(n: number, symbol: string) {
  return `${symbol}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function ProbabilityBar({ pct }: { pct: number }) {
  const filled = Math.round(pct / 5);
  const empty  = 20 - filled;
  const color =
    pct >= 75 ? "text-chart-green" : pct >= 50 ? "text-chart-blue" : "text-chart-red";

  return (
    <div className="font-mono">
      <span className={color}>{"█".repeat(filled)}</span>
      <span className="text-terminal-dim">{"░".repeat(empty)}</span>
      <span className={`ml-2 font-bold ${color}`}>{pct.toFixed(0)}%</span>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-terminal-border bg-terminal-surface">
      <div className="border-b border-terminal-border px-4 py-2">
        <span className="text-[10px] text-terminal-muted uppercase tracking-widest">
          // {title}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function MetricRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-terminal-border last:border-0">
      <span className="text-terminal-muted text-[11px] uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-bold ${highlight ? "text-terminal-white" : "text-terminal-text"}`}>
        {value}
      </span>
    </div>
  );
}

export default function ResultsPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const router = useRouter();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("gb_session");
    if (!raw) { setNotFound(true); return; }
    try {
      const s = JSON.parse(raw) as StoredSession;
      if (s.result.report_uuid !== uuid) { setNotFound(true); return; }
      setSession(s);
    } catch {
      setNotFound(true);
    }
  }, [uuid]);

  if (notFound) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <p className="text-chart-red mb-2">&gt; Report not found or session expired.</p>
          <button onClick={() => router.push("/compute")} className="btn btn-primary mt-4">
            [ RUN NEW SIMULATION ]
          </button>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="text-terminal-muted text-sm">Loading<span className="animate-blink">█</span></span>
      </main>
    );
  }

  const { result, form } = session;
  const sym = result.currency_symbol;
  const surplus = result.surplus_after_savings;
  const surplusColor = surplus >= 0 ? "text-chart-green" : "text-chart-red";

  return (
    <main className="min-h-screen bg-terminal-bg">
      {/* Top bar */}
      <div className="border-b border-terminal-border px-6 py-3 flex items-center justify-between">
        <a href="/" className="text-terminal-white font-bold tracking-widest text-sm hover:text-terminal-muted transition-colors">
          GOALBUILDER
        </a>
        <span className="text-terminal-muted text-[11px] hidden sm:block">
          UUID: {result.report_uuid}
        </span>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4 fade-in">

        {/* Header */}
        <div className="border border-terminal-border bg-terminal-panel px-6 py-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="text-terminal-muted text-[11px] uppercase tracking-widest">Simulation complete</p>
              <h1 className="text-terminal-white text-xl font-bold mt-0.5">{form.goal_name}</h1>
              <p className="text-terminal-muted text-[12px] mt-1">
                {form.country} · {result.risk_profile} · {form.time_horizon_years} year
                {form.time_horizon_years !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-terminal-muted text-[10px] uppercase tracking-widest">UUID</p>
              <p className="text-terminal-dim text-[11px] mt-0.5">{result.report_uuid}</p>
            </div>
          </div>
        </div>

        {/* 3-column key metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Required monthly savings */}
          <Panel title="Required monthly savings">
            <p className="text-terminal-muted text-[11px] mb-1">To hit your goal</p>
            <p className="text-3xl font-bold text-terminal-white">
              {fmt(result.required_monthly_savings, sym)}
            </p>
            <p className="text-terminal-muted text-[11px] mt-2">per month</p>
          </Panel>

          {/* Probability */}
          <Panel title="Probability of success">
            <p className="text-terminal-muted text-[11px] mb-3">Across 1,000 simulations</p>
            <ProbabilityBar pct={result.probability_of_success} />
            <p className="text-terminal-muted text-[11px] mt-3">
              {result.probability_of_success >= 75
                ? "High confidence. On track."
                : result.probability_of_success >= 50
                ? "Moderate. Consider saving more or extending your horizon."
                : "Low. Adjust your plan — more savings or longer horizon."}
            </p>
          </Panel>

          {/* Surplus */}
          <Panel title="Monthly surplus">
            <p className="text-terminal-muted text-[11px] mb-1">After savings + expenses</p>
            <p className={`text-3xl font-bold ${surplusColor}`}>
              {fmt(Math.abs(surplus), sym)}
            </p>
            <p className={`text-[12px] mt-2 ${surplusColor}`}>
              {surplus >= 0 ? "Surplus — you can afford this goal." : "Shortfall — review your budget or goal."}
            </p>
          </Panel>
        </div>

        {/* Chart */}
        <Panel title={`Portfolio projection — ${form.time_horizon_years} years`}>
          <MonteCarloChart
            data={result.chart_data}
            targetValue={result.inflation_adjusted_goal_value}
            currencySymbol={sym}
            timeHorizonMonths={result.time_horizon_months}
          />
        </Panel>

        {/* Percentile outcomes + model details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Panel title="Projected outcomes at goal date">
            <MetricRow
              label="Pessimistic (10th pct)"
              value={fmt(result.final_p10, sym)}
            />
            <MetricRow
              label="Median (50th pct)"
              value={fmt(result.final_p50, sym)}
              highlight
            />
            <MetricRow
              label="Optimistic (90th pct)"
              value={fmt(result.final_p90, sym)}
            />
            <MetricRow
              label="Inflation-adjusted target"
              value={fmt(result.inflation_adjusted_goal_value, sym)}
            />
          </Panel>

          <Panel title="Model assumptions">
            <MetricRow
              label="Blended annual return"
              value={`${(result.blended_annual_return * 100).toFixed(1)}%`}
            />
            <MetricRow
              label="Inflation rate"
              value={`${(result.inflation_rate * 100).toFixed(1)}%`}
            />
            <MetricRow
              label="Existing savings"
              value={fmt(form.existing_savings, sym)}
            />
            <MetricRow
              label="Simulations run"
              value="1,000"
            />
            <MetricRow
              label="Compounding"
              value="Monthly"
            />
          </Panel>
        </div>

        {/* Actions */}
        <div className="border border-terminal-border bg-terminal-surface p-4 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary flex-1 text-sm"
          >
            [ DOWNLOAD PDF REPORT ]
          </button>
          <button
            onClick={() => router.push("/compute")}
            className="btn flex-1 text-sm"
          >
            [ RUN NEW SCENARIO ]
          </button>
        </div>

        {/* Disclaimer */}
        <p className="text-terminal-muted text-[11px] leading-relaxed border-t border-terminal-border pt-4">
          DISCLAIMER: This tool is for educational and illustrative purposes only. It does not
          constitute investment advice or a recommendation to buy or sell any securities.
          Projected returns are based on historical averages and are not guaranteed.
          Past performance is not indicative of future results.
        </p>
      </div>

      {showModal && (
        <CoffeeModal
          result={result}
          form={form}
          onClose={() => setShowModal(false)}
        />
      )}
    </main>
  );
}
