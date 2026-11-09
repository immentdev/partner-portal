/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import { LoginForm } from "./login-form";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 py-16">
      <div className="space-y-2 text-center">
        <p className="font-display text-3xl font-semibold tracking-tight text-trust-dark">
          Imment
        </p>
        <h1 className="text-lg text-trust-dark/80">Partner Portal BAC</h1>
        <p className="text-sm text-trust-dark/60">
          Accedi con le credenziali invitate. Nessuna registrazione libera.
        </p>
      </div>
      <LoginForm nextPath={searchParams.next} error={searchParams.error} />
    </div>
  );
}
