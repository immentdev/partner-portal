/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}) {
  const resend = getResend();
  const from =
    process.env.EMAIL_FROM?.trim() || "Partner Portal <onboarding@resend.dev>";

  if (!resend) {
    console.warn("[email] RESEND_API_KEY assente — skip:", input.subject, input.to);
    return { skipped: true as const };
  }

  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  if (error) {
    console.error("[email] Resend error:", error);
    throw new Error(error.message);
  }
  return { skipped: false as const, id: data?.id };
}
