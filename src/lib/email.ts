// Email sending (server-only). No SDK needed, both transports are one HTTP call:
//   RESEND_API_KEY set → Resend (real email; EMAIL_FROM must use a domain verified in Resend)
//   else MAILPIT_URL   → Mailpit (dev: nothing leaves the machine, inbox at http://localhost:8025)
//   else               → not configured: logged and reported as failed, so the jobs retry later.

export type Mail = { to: string; subject: string; html: string; text: string };
export type SendResult = { ok: true } | { ok: false; error: string };

const FROM = process.env.EMAIL_FROM ?? "Nexora IT <orders@nexora.test>";

/** Public site URL for links in emails (jobs run without a request, so this can't come from headers). */
export const APP_URL = (process.env.APP_URL ?? "http://localhost:3100").replace(/\/$/, "");

function parseFrom(from: string) {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1], email: m[2] } : { name: "", email: from.trim() };
}

export const emailTransport = process.env.RESEND_API_KEY ? "resend" : process.env.MAILPIT_URL ? "mailpit" : null;

export async function sendMail(mail: Mail): Promise<SendResult> {
  try {
    if (process.env.RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok ? { ok: true } : { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
    }
    if (process.env.MAILPIT_URL) {
      const from = parseFrom(FROM);
      const res = await fetch(`${process.env.MAILPIT_URL.replace(/\/$/, "")}/api/v1/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ From: { Email: from.email, Name: from.name }, To: [{ Email: mail.to }], Subject: mail.subject, HTML: mail.html, Text: mail.text }),
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok ? { ok: true } : { ok: false, error: `Mailpit ${res.status}: ${(await res.text()).slice(0, 300)}` };
    }
    console.warn(`[email] not configured, not sent: "${mail.subject}" to ${mail.to}`);
    return { ok: false, error: "Email is not configured (set RESEND_API_KEY, or MAILPIT_URL for development)." };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
