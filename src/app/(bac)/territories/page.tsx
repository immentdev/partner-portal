/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/ui/labels";

export default async function TerritoriesPage() {
  const supabase = createClient();

  const { data: territories } = await supabase
    .schema("partner")
    .from("territories")
    .select("id, code, name")
    .order("code");

  const { data: referrals } = await supabase
    .schema("partner")
    .from("referrals")
    .select("id, territory_id, outcome, macrostate");

  const { data: fees } = await supabase
    .schema("partner")
    .from("v_deal_fees")
    .select("referral_id, fee_maturata, fee_prevista, is_primary")
    .eq("is_primary", true);

  const feeByRef = new Map(
    (fees ?? []).map((f) => [f.referral_id as string, f]),
  );

  const rows = (territories ?? []).map((t) => {
    const refs = (referrals ?? []).filter((r) => r.territory_id === t.id);
    const accepted = refs.filter((r) => r.outcome === "accepted").length;
    const converted = refs.filter(
      (r) => r.macrostate === "incarico_attivo",
    ).length;
    let maturata = 0;
    let prevista = 0;
    for (const r of refs) {
      const f = feeByRef.get(r.id);
      maturata += Number(f?.fee_maturata ?? 0);
      prevista += Number(f?.fee_prevista ?? 0);
    }
    return {
      ...t,
      sent: refs.length,
      accepted,
      converted,
      maturata,
      prevista,
      daLiquidare: maturata,
    };
  });

  const totalSent = rows.reduce((acc, r) => acc + r.sent, 0);
  const totalMaturata = rows.reduce((acc, r) => acc + r.maturata, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Territori</h1>
        <p className="page-sub">
          Vista Nazionale · {totalSent} segnalazioni · fee maturata{" "}
          <span className="num font-medium text-[var(--text)]">
            {formatMoney(totalMaturata)}
          </span>
          . Liquidazioni in Fase 4.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr>
              <th className="table-head table-cell">Territorio</th>
              <th className="table-head table-cell text-right">Inviati</th>
              <th className="table-head table-cell text-right">Accettati</th>
              <th className="table-head table-cell text-right">Convertiti</th>
              <th className="table-head table-cell text-right">Fee maturata</th>
              <th className="table-head table-cell text-right">Fee prevista</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="border border-dashed border-[var(--control)] px-4 py-8 text-center text-[14px] text-[var(--muted)]"
                >
                  Nessun territorio configurato.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--rule)]">
                  <td className="table-cell">
                    <span className="font-medium">{r.code}</span>
                    <span className="text-[var(--muted)]"> · {r.name}</span>
                  </td>
                  <td className="table-cell num text-right">{r.sent}</td>
                  <td className="table-cell num text-right">{r.accepted}</td>
                  <td className="table-cell num text-right">{r.converted}</td>
                  <td className="table-cell num text-right">
                    {formatMoney(r.maturata)}
                  </td>
                  <td className="table-cell num text-right text-[var(--muted)]">
                    {formatMoney(r.prevista)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
