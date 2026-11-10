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
    <div className="space-y-6">
      <div className="rounded-[var(--radius-sheet)] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
        <div className="mb-6 space-y-2">
          <h1 className="page-title">Accedi</h1>
          <p className="page-sub">
            Credenziali invitate per i partner BAC. Nessuna registrazione libera.
          </p>
        </div>
        <LoginForm nextPath={searchParams.next} error={searchParams.error} />
        <dl className="mt-8 grid gap-3 border-t border-[var(--rule)] pt-6 text-[13px] sm:grid-cols-3">
          <div>
            <dt className="text-[var(--faint)]">Per chi</dt>
            <dd className="mt-1 font-medium text-[var(--text)]">BAC e Imment</dd>
          </div>
          <div>
            <dt className="text-[var(--faint)]">Cosa trovi</dt>
            <dd className="mt-1 font-medium text-[var(--text)]">
              Segnalazioni e fee
            </dd>
          </div>
          <div>
            <dt className="text-[var(--faint)]">Stati</dt>
            <dd className="mt-1 font-medium text-[var(--text)]">Da Mokapen</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
