"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import type { ChartPoint } from "@/lib/types";

interface Props {
  data: ChartPoint[];
  targetValue: number;
  currencySymbol: string;
  timeHorizonMonths: number;
}

function formatCurrency(value: number, symbol: string): string {
  if (value >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `${symbol}${(value / 1_000).toFixed(0)}K`;
  return `${symbol}${value.toFixed(0)}`;
}

function CustomTooltip({
  active, payload, label, symbol,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: number;
  symbol: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-terminal-border bg-terminal-bg p-3 text-[11px] font-mono">
      <p className="text-terminal-muted mb-2">Month {label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value, symbol)}
        </p>
      ))}
    </div>
  );
}

export default function MonteCarloChart({ data, targetValue, currencySymbol, timeHorizonMonths }: Props) {
  // Convert month index to year label for the X axis
  const displayData = data.map((d) => ({
    ...d,
    year: +(d.month / 12).toFixed(1),
  }));

  const maxValue = Math.max(...data.map((d) => d.p90), targetValue) * 1.05;

  return (
    <div className="w-full">
      <p className="text-[10px] text-terminal-muted uppercase tracking-widest mb-3">
        // Portfolio projection — 1,000 simulations
      </p>

      <div className="flex gap-4 mb-4 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-px bg-chart-green" style={{ borderTop: "2px solid #22c55e" }} />
          <span className="text-chart-green">90th pct (optimistic)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-px bg-chart-blue" style={{ borderTop: "2px solid #3b82f6" }} />
          <span className="text-chart-blue">50th pct (median)</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-px bg-chart-red" style={{ borderTop: "2px dotted #ef4444" }} />
          <span className="text-chart-red">10th pct (pessimistic)</span>
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={displayData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />

          <XAxis
            dataKey="year"
            tickFormatter={(v) => `Yr ${v}`}
            tick={{ fill: "#555", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
            axisLine={{ stroke: "#2a2a2a" }}
            tickLine={false}
          />

          <YAxis
            tickFormatter={(v) => formatCurrency(v, currencySymbol)}
            tick={{ fill: "#555", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}
            axisLine={{ stroke: "#2a2a2a" }}
            tickLine={false}
            domain={[0, maxValue]}
            width={70}
          />

          <Tooltip content={<CustomTooltip symbol={currencySymbol} />} />

          {/* Dashed reference line for the target */}
          <ReferenceLine
            y={targetValue}
            stroke="#444"
            strokeDasharray="4 4"
            label={{
              value: `Target: ${formatCurrency(targetValue, currencySymbol)}`,
              fill: "#555",
              fontSize: 10,
              fontFamily: "JetBrains Mono, monospace",
              position: "insideTopRight",
            }}
          />

          <Line
            type="monotone"
            dataKey="p90"
            name="90th pct"
            stroke="#22c55e"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: "#22c55e" }}
          />
          <Line
            type="monotone"
            dataKey="p50"
            name="50th pct"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: "#3b82f6" }}
          />
          <Line
            type="monotone"
            dataKey="p10"
            name="10th pct"
            stroke="#ef4444"
            strokeWidth={1.5}
            strokeDasharray="4 2"
            dot={false}
            activeDot={{ r: 3, fill: "#ef4444" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
