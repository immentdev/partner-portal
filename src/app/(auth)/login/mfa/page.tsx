/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import { MfaForm } from "./mfa-form";
import { LogoutButton } from "@/components/shell/LogoutButton";

export default function MfaPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="page-title">Verifica MFA</h1>
        <p className="page-sub">
          Inserisci il codice dell&apos;app di autenticazione (TOTP).
        </p>
      </div>
      <MfaForm nextPath={searchParams.next} />
      <div className="flex justify-center">
        <LogoutButton />
      </div>
    </div>
  );
}
