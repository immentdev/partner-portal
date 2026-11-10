/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

export default function StatementsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Rendiconti</h1>
        <p className="page-sub">
          Approvazione Nazionale delle fee maturate. Disponibile in Fase 4.
        </p>
      </div>
      <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--control)] px-4 py-10 text-center">
        <p className="text-[14px] text-[var(--muted)]">
          Nessun rendiconto da approvare. Quando le liquidazioni saranno attive,
          i totali per territorio appariranno qui.
        </p>
      </div>
    </div>
  );
}
