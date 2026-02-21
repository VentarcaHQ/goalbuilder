import type {
  ComputeRequest,
  SimulationResult,
  RateLimitError,
} from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── Compute simulation ───────────────────────────────────────────────────────

export async function computeSimulation(
  payload: ComputeRequest
): Promise<SimulationResult> {
  const res = await fetch(`${API}/compute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.status === 402) {
    const err = await res.json();
    // Throw a structured error the form can catch and show the paywall
    throw { type: "RATE_LIMIT", detail: err.detail as RateLimitError };
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Simulation failed. Please try again.");
  }

  return res.json();
}

// ─── PDF download ─────────────────────────────────────────────────────────────

export async function downloadPdf(
  reportUuid: string,
  data: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${API}/report/${reportUuid}/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) throw new Error("Failed to generate PDF.");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `goalbuilder-${reportUuid.slice(0, 8)}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Newsletter subscribe ─────────────────────────────────────────────────────

export async function subscribeEmail(
  email: string,
  country: string,
  reportUuid: string
): Promise<void> {
  await fetch(`${API}/report/${reportUuid}/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, country, report_uuid: reportUuid }),
  });
  // Silently ignore errors — subscription is optional
}

// ─── Stripe payment ───────────────────────────────────────────────────────────

export async function createPayment(
  ipHash: string,
  reportUuid: string
): Promise<string> {
  const res = await fetch(`${API}/payment/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ip_hash: ipHash, report_uuid: reportUuid }),
  });
  if (!res.ok) throw new Error("Could not initiate payment.");
  const data = await res.json();
  return data.checkout_url as string;
}

export async function verifyPayment(
  stripeSessionId: string,
  reportUuid: string
): Promise<boolean> {
  const res = await fetch(`${API}/payment/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stripe_session_id: stripeSessionId, report_uuid: reportUuid }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.unlocked === true;
}
