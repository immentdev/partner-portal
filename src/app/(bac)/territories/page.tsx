/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import { createClient } from "@/lib/supabase/server";

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
      daLiquidare: maturata, // liquidata arriva in Fase 4
    };
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-2xl font-semibold text-trust-dark">
        Riepilogo territori
      </h1>
      <p className="mt-1 text-sm text-trust-dark/65">
        Vista Nazionale — fee da Mokapen; liquidazioni in Fase 4.
      </p>

      <div className="mt-6 overflow-x-auto rounded-card bg-white shadow-soft">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-trust-dark/10 bg-trust-dark/[0.03] text-trust-dark/70">
            <tr>
              <th className="px-4 py-3 font-medium">Territorio</th>
              <th className="px-4 py-3 font-medium">Inviati</th>
              <th className="px-4 py-3 font-medium">Accettati</th>
              <th className="px-4 py-3 font-medium">Convertiti</th>
              <th className="px-4 py-3 font-medium">Fee maturata</th>
              <th className="px-4 py-3 font-medium">Fee prevista</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-trust-dark/5">
                <td className="px-4 py-3">
                  {r.code} — {r.name}
                </td>
                <td className="px-4 py-3">{r.sent}</td>
                <td className="px-4 py-3">{r.accepted}</td>
                <td className="px-4 py-3">{r.converted}</td>
                <td className="px-4 py-3">
                  € {r.maturata.toLocaleString("it-IT")}
                </td>
                <td className="px-4 py-3">
                  € {r.prevista.toLocaleString("it-IT")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
