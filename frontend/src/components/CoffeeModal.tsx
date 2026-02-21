"use client";

import { useState } from "react";
import { subscribeEmail, downloadPdf } from "@/lib/api";
import type { SimulationResult, GoalFormData } from "@/lib/types";

interface Props {
  result: SimulationResult;
  form: GoalFormData;
  onClose: () => void;
}

export default function CoffeeModal({ result, form, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [emailError, setEmailError] = useState("");

  const BMAC_URL = process.env.NEXT_PUBLIC_BMAC_URL ?? "https://buymeacoffee.com/goalbuilder";

  const handleSubscribe = async () => {
    if (!email || !email.includes("@")) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError("");
    await subscribeEmail(email, result.country, result.report_uuid);
    setSubscribed(true);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Build the full payload the PDF endpoint needs
      const pdfPayload = {
        ...result,
        goal_name: form.goal_name,
        goal_value: form.goal_value,
        time_horizon_years: form.time_horizon_years,
      };
      await downloadPdf(result.report_uuid, pdfPayload);
      onClose();
    } catch {
      alert("PDF generation failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-md border border-terminal-border bg-terminal-surface slide-up">

        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-terminal-border px-4 py-2">
          <span className="text-[10px] text-terminal-muted tracking-widest uppercase">
            download report
          </span>
          <button onClick={onClose} className="text-terminal-muted hover:text-terminal-white text-xs">
            [ESC]
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* ── 1. Coffee prompt ─────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] text-terminal-muted uppercase tracking-widest mb-2">
              // 01 — support us
            </p>
            <p className="text-terminal-text text-sm leading-relaxed">
              GoalBuilder is free and open source. If this helped you plan
              your future, consider buying us a coffee — it keeps the lights on.
            </p>
            <a
              href={BMAC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 btn text-[12px]"
            >
              ☕ BUY US A COFFEE
            </a>
          </div>

          <div className="h-px bg-terminal-border" />

          {/* ── 2. Newsletter opt-in ──────────────────────────────────────── */}
          <div>
            <p className="text-[10px] text-terminal-muted uppercase tracking-widest mb-2">
              // 02 — stay in the loop (optional)
            </p>
            <p className="text-terminal-text text-[12px] leading-relaxed mb-3">
              Get tips on saving for a house, kids&apos; education, paying off debt,
              and more. No spam. Unsubscribe any time.
            </p>

            {subscribed ? (
              <p className="text-chart-green text-[12px]">
                ✓ You&apos;re subscribed. Thanks!
              </p>
            ) : (
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubscribe()}
                  className="flex-1 bg-terminal-bg border border-terminal-border px-3 py-2 text-terminal-white text-[12px] font-mono outline-none focus:border-terminal-text"
                />
                <button onClick={handleSubscribe} className="btn text-[12px] whitespace-nowrap">
                  SUBSCRIBE
                </button>
              </div>
            )}
            {emailError && (
              <p className="text-chart-red text-[11px] mt-1">{emailError}</p>
            )}
          </div>

          <div className="h-px bg-terminal-border" />

          {/* ── 3. Download button ────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] text-terminal-muted uppercase tracking-widest mb-3">
              // 03 — download your report
            </p>
            <p className="text-terminal-muted text-[11px] mb-3">
              UUID: <span className="text-terminal-text">{result.report_uuid}</span>
            </p>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="btn btn-primary w-full text-sm"
            >
              {downloading ? "[ GENERATING PDF... ]" : "[ DOWNLOAD PDF REPORT ]"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
