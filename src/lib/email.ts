// Real email sending via Resend's HTTP API (https://resend.com) — a plain
// fetch call, no SDK needed. Requires RESEND_API_KEY and ALERT_EMAIL_FROM to
// be configured; when they aren't, this honestly reports that nothing was
// sent instead of pretending to succeed.
export interface SendEmailResult {
  sent: boolean;
  reason?: string;
}

export async function sendEmail(to: string[], subject: string, html: string): Promise<SendEmailResult> {
  if (to.length === 0) return { sent: false, reason: "no recipients" };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_EMAIL_FROM;
  if (!apiKey || !from) return { sent: false, reason: "Email sending isn't connected yet (RESEND_API_KEY / ALERT_EMAIL_FROM not configured)." };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { sent: false, reason: `Resend API error ${res.status}: ${body.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
