/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import { sendEmail } from "./resend";
import type { Macrostate } from "@/lib/domain/macrostate";

const LABELS: Record<Macrostate, string> = {
  in_valutazione: "In valutazione",
  non_accettato: "Non accettato",
  proposta_inviata: "Proposta inviata",
  incarico_attivo: "Incarico attivo",
  chiuso_non_acquisito: "Chiuso non acquisito",
};

export async function sendMacrostateChangeEmail(input: {
  to: string;
  companyName: string;
  referralCode: string;
  previous: Macrostate | null;
  next: Macrostate;
  stageTitle: string;
}) {
  const prevLabel = input.previous ? LABELS[input.previous] : "—";
  const nextLabel = LABELS[input.next];

  return sendEmail({
    to: input.to,
    subject: `${input.referralCode}: aggiornamento stato — ${nextLabel}`,
    html: `
      <p>Ciao,</p>
      <p>la segnalazione <strong>${input.referralCode}</strong>
      (<strong>${input.companyName}</strong>) ha cambiato macrostato.</p>
      <p>${prevLabel} → <strong>${nextLabel}</strong>
      (fase Mokapen: ${input.stageTitle}).</p>
      <p>Dettagli nel Partner Portal.</p>
      <p>Imment · Partner Portal BAC</p>
    `,
    text: `${input.referralCode}: ${prevLabel} → ${nextLabel}`,
  });
}
