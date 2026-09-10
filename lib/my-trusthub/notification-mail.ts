import "server-only";

export type ProviderOutcome = "success" | "transient_failure" | "permanent_failure" | "invalid_destination" | "provider_error" | "rate_limited";

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export async function sendMyTrustHubEmail(input: { to: string; subject: string; text: string }): Promise<{ outcome: ProviderOutcome; providerMessageRef?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { outcome: "provider_error" };
  if (!/^\S+@\S+\.\S+$/.test(input.to)) return { outcome: "invalid_destination" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.ASK_AUTH_FROM_EMAIL || process.env.AUTH_FROM_EMAIL || "Ask Trust Hub <hello@asktrusthub.com>",
        to: [input.to], subject: input.subject,
        text: input.text,
        html: `<div style="font-family:Arial,sans-serif;white-space:pre-line">${escapeHtml(input.text)}</div>`,
      }),
    });
    const payload = await response.json().catch(() => ({})) as { id?: string; message?: string };
    if (response.ok) return { outcome: "success", providerMessageRef: payload.id };
    if (response.status === 400 || response.status === 404) return { outcome: "invalid_destination" };
    if (response.status === 429) return { outcome: "rate_limited" };
    if (response.status >= 500) return { outcome: "transient_failure" };
    return { outcome: "permanent_failure" };
  } catch {
    return { outcome: "transient_failure" };
  }
}
