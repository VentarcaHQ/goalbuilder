"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { verifyPayment } from "@/lib/api";

function PaymentSuccessContent() {
  const params    = useSearchParams();
  const router    = useRouter();
  const sessionId = params.get("session_id") ?? "";
  const uuid      = params.get("uuid") ?? "pending";

  const [status, setStatus] = useState<"verifying" | "ok" | "error">("verifying");

  useEffect(() => {
    if (!sessionId) { setStatus("error"); return; }

    verifyPayment(sessionId, uuid).then((ok) => {
      if (ok) {
        setStatus("ok");
        setTimeout(() => router.push("/compute"), 2000);
      } else {
        setStatus("error");
      }
    });
  }, [sessionId, uuid, router]);

  return (
    <div className="w-full max-w-sm border border-terminal-border bg-terminal-surface p-8 text-center">
      {status === "verifying" && (
        <>
          <p className="text-terminal-muted text-sm mb-2">Verifying payment</p>
          <span className="inline-block w-2 h-4 bg-terminal-white animate-blink" />
        </>
      )}
      {status === "ok" && (
        <>
          <p className="text-chart-green font-bold mb-2">✓ Payment confirmed</p>
          <p className="text-terminal-muted text-[12px]">
            Redirecting you back to run your simulation...
          </p>
        </>
      )}
      {status === "error" && (
        <>
          <p className="text-chart-red font-bold mb-2">Payment verification failed</p>
          <p className="text-terminal-muted text-[12px] mb-4">
            If you were charged, please contact us with your session ID:
            <br />
            <span className="text-terminal-text">{sessionId}</span>
          </p>
          <button onClick={() => router.push("/compute")} className="btn btn-primary">
            [ TRY AGAIN ]
          </button>
        </>
      )}
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Suspense fallback={
        <div className="border border-terminal-border bg-terminal-surface p-8">
          <span className="text-terminal-muted text-sm">Loading<span className="animate-blink">█</span></span>
        </div>
      }>
        <PaymentSuccessContent />
      </Suspense>
    </main>
  );
}
