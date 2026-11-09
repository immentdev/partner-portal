/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import { sendEmail } from "./resend";

export async function sendReferralConfirmation(input: {
  to: string;
  companyName: string;
  referralCode: string;
  syncPending: boolean;
}) {
  const statusLine = input.syncPending
    ? "La segnalazione risulta <strong>inviata, in registrazione</strong> sul CRM."
    : "La segnalazione è stata registrata correttamente.";

  return sendEmail({
    to: input.to,
    subject: `Segnalazione ${input.referralCode} ricevuta — Partner Portal`,
    html: `
      <p>Ciao,</p>
      <p>abbiamo ricevuto la segnalazione <strong>${input.referralCode}</strong>
      per <strong>${input.companyName}</strong>.</p>
      <p>${statusLine}</p>
      <p>Potrai seguirne lo stato commerciale e le fee dal Partner Portal.</p>
      <p>Imment · Partner Portal BAC</p>
    `,
    text: `Segnalazione ${input.referralCode} per ${input.companyName} ricevuta.`,
  });
}
