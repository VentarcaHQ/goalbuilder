"use client";

import { useState } from "react";
import { createPayment } from "@/lib/api";
import type { RateLimitError } from "@/lib/types";

interface Props {
  data: RateLimitError;
  onClose: () => void;
}

export default function PaywallModal({ data, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePay = async () => {
    setLoading(true);
    setError("");
    try {
      // We use the ip_hash from the 402 response — no UUID yet (user hasn't run the sim)
      // The backend will create a Stripe session and we redirect to it.
      // The report_uuid here is a placeholder; the actual UUID is generated after payment.
      const checkoutUrl = await createPayment(data.ip_hash, "pending");
      window.location.href = checkoutUrl;
    } catch {
      setError("Payment could not be initiated. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
      <div className="w-full max-w-md border border-terminal-border bg-terminal-surface slide-up">

        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-terminal-border px-4 py-2">
          <span className="text-[10px] text-terminal-muted tracking-widest uppercase">
            daily limit reached
          </span>
          <button onClick={onClose} className="text-terminal-muted hover:text-terminal-white text-xs">
            [ESC]
          </button>
        </div>

        <div className="p-6">
          <div className="border border-chart-amber/30 bg-chart-amber/5 p-4 mb-6">
            <p className="text-chart-amber text-[12px] font-bold mb-1">RATE LIMIT</p>
            <p className="text-terminal-text text-[12px] leading-relaxed">
              You&apos;ve used {data.free_used} of {data.free_limit} free reports today.
              Come back tomorrow for more free reports, or pay $3 to run another
              simulation right now.
            </p>
          </div>

          <div className="space-y-3 mb-6 text-[12px] text-terminal-muted">
            <p>✓ Instant access — one additional report</p>
            <p>✓ Same simulation quality</p>
            <p>✓ PDF report included</p>
            <p>✓ Processed securely via Stripe</p>
          </div>

          {error && (
            <p className="text-chart-red text-[11px] border border-chart-red/30 p-2 mb-4">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="btn flex-1">
              [ COME BACK TOMORROW ]
            </button>
            <button
              onClick={handlePay}
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? "[ REDIRECTING... ]" : "[ PAY $3 ]"}
            </button>
          </div>

          <p className="text-terminal-muted text-[10px] text-center mt-4">
            Payments processed by Stripe. GoalBuilder does not store card details.
          </p>
        </div>
      </div>
    </div>
  );
}
