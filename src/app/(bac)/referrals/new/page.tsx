/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import Link from "next/link";
import { ReferralForm } from "./referral-form";

export default function NewReferralPage() {
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="space-y-2">
        <Link
          href="/referrals"
          className="text-[13px] text-[var(--muted)] hover:text-[var(--text)]"
        >
          ← Elenco segnalazioni
        </Link>
        <h1 className="page-title">Nuova segnalazione</h1>
        <p className="page-sub">
          Territorio e organizzazione dal tuo profilo. La fee arriva da Mokapen,
          non viene calcolata qui.
        </p>
      </div>
      <ReferralForm />
    </div>
  );
}
