/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import { MfaForm } from "./mfa-form";

export default function MfaPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-2xl font-semibold text-trust-dark">
          Verifica MFA
        </h1>
        <p className="text-sm text-trust-dark/65">
          Inserisci il codice dell&apos;app di autenticazione (TOTP).
        </p>
      </div>
      <MfaForm nextPath={searchParams.next} />
    </div>
  );
}
