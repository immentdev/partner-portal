/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import { ReferralForm } from "./referral-form";

export default function NewReferralPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <div className="mb-6 space-y-1">
        <h1 className="font-display text-2xl font-semibold text-trust-dark">
          Nuova segnalazione
        </h1>
        <p className="text-sm text-trust-dark/65">
          Territorio e organizzazione sono presi dal tuo profilo. La fee non
          viene calcolata qui: arriva da Mokapen.
        </p>
      </div>
      <ReferralForm />
    </div>
  );
}
