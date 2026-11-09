/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/roles";

function feeLabel(value: number | null | undefined, kind: "prevista" | "maturata") {
  if (value == null || Number(value) === 0) {
    return kind === "maturata" ? "nessuna fee maturata" : "—";
  }
  return `€ ${Number(value).toLocaleString("it-IT", { minimumFractionDigits: 0 })}`;
}

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: {
    territory?: string;
    macrostate?: string;
    from?: string;
    to?: string;
  };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .schema("partner")
    .from("profiles")
    .select("role, partner_org_id")
    .eq("id", user!.id)
    .single();

  const role = profile?.role as AppRole | undefined;
  const isNazionale = role === "bac_nazionale" || role === "super_admin" || role === "imment_admin";

  let query = supabase
    .schema("partner")
    .from("referrals")
    .select(
      "id, code, company_name, created_at, macrostate, outcome, updated_at, territory_id, territories(code, name)",
    )
    .order("created_at", { ascending: false });

  if (searchParams.macrostate) {
    query = query.eq("macrostate", searchParams.macrostate);
  }
  if (searchParams.territory) {
    query = query.eq("territory_id", searchParams.territory);
  }
  if (searchParams.from) {
    query = query.gte("created_at", searchParams.from);
  }
  if (searchParams.to) {
    query = query.lte("created_at", `${searchParams.to}T23:59:59`);
  }

  const { data: referrals, error } = await query;

  const referralIds = (referrals ?? []).map((r) => r.id);
  const { data: fees } = referralIds.length
    ? await supabase
        .schema("partner")
        .from("v_deal_fees")
        .select("referral_id, fee_prevista, fee_maturata, is_primary")
        .in("referral_id", referralIds)
        .eq("is_primary", true)
    : { data: [] as Array<{ referral_id: string; fee_prevista: number; fee_maturata: number }> };

  const feeByReferral = new Map(
    (fees ?? []).map((f) => [f.referral_id, f]),
  );

  const { data: territories } = isNazionale
    ? await supabase
        .schema("partner")
        .from("territories")
        .select("id, code, name")
        .order("code")
    : { data: [] as Array<{ id: string; code: string; name: string }> };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-trust-dark">
            Segnalazioni
          </h1>
          <p className="text-sm text-trust-dark/65">
            Stato commerciale e fee (da Mokapen). Separazione territori via RLS.
          </p>
        </div>
        <Link
          href="/referrals/new"
          className="rounded-control bg-trust px-3 py-2 text-sm font-medium text-white"
        >
          Nuova segnalazione
        </Link>
      </div>

      {isNazionale ? (
        <form className="mb-4 flex flex-wrap gap-3 rounded-card bg-white p-4 shadow-soft">
          <label className="text-sm">
            Territorio
            <select
              name="territory"
              defaultValue={searchParams.territory ?? ""}
              className="ml-2 rounded-control border border-trust-dark/15 px-2 py-1"
            >
              <option value="">Tutti</option>
              {(territories ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Macrostato
            <select
              name="macrostate"
              defaultValue={searchParams.macrostate ?? ""}
              className="ml-2 rounded-control border border-trust-dark/15 px-2 py-1"
            >
              <option value="">Tutti</option>
              <option value="in_valutazione">In valutazione</option>
              <option value="non_accettato">Non accettato</option>
              <option value="proposta_inviata">Proposta inviata</option>
              <option value="incarico_attivo">Incarico attivo</option>
              <option value="chiuso_non_acquisito">Chiuso non acquisito</option>
            </select>
          </label>
          <label className="text-sm">
            Dal
            <input
              type="date"
              name="from"
              defaultValue={searchParams.from ?? ""}
              className="ml-2 rounded-control border border-trust-dark/15 px-2 py-1"
            />
          </label>
          <label className="text-sm">
            Al
            <input
              type="date"
              name="to"
              defaultValue={searchParams.to ?? ""}
              className="ml-2 rounded-control border border-trust-dark/15 px-2 py-1"
            />
          </label>
          <button
            type="submit"
            className="rounded-control bg-trust-dark px-3 py-1.5 text-sm text-white"
          >
            Filtra
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="text-sm text-equity">{error.message}</p>
      ) : (
        <div className="overflow-x-auto rounded-card bg-white shadow-soft">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-trust-dark/10 bg-trust-dark/[0.03] text-trust-dark/70">
              <tr>
                <th className="px-4 py-3 font-medium">Codice</th>
                <th className="px-4 py-3 font-medium">Startup</th>
                {isNazionale ? (
                  <th className="px-4 py-3 font-medium">Territorio</th>
                ) : null}
                <th className="px-4 py-3 font-medium">Macrostato</th>
                <th className="px-4 py-3 font-medium">Fee prevista</th>
                <th className="px-4 py-3 font-medium">Fee maturata</th>
                <th className="px-4 py-3 font-medium">Aggiornato</th>
              </tr>
            </thead>
            <tbody>
              {(referrals ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={isNazionale ? 7 : 6}
                    className="px-4 py-8 text-center text-trust-dark/50"
                  >
                    Nessuna segnalazione
                  </td>
                </tr>
              ) : (
                (referrals ?? []).map((r) => {
                  const fee = feeByReferral.get(r.id);
                  const terr = r.territories as
                    | { code?: string; name?: string }
                    | { code?: string; name?: string }[]
                    | null;
                  const terrLabel = Array.isArray(terr)
                    ? terr[0]?.code
                    : terr?.code;
                  return (
                    <tr key={r.id} className="border-t border-trust-dark/5">
                      <td className="px-4 py-3">
                        <Link
                          className="text-trust hover:underline"
                          href={`/referrals/${r.id}`}
                        >
                          {r.code}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{r.company_name}</td>
                      {isNazionale ? (
                        <td className="px-4 py-3">{terrLabel ?? "—"}</td>
                      ) : null}
                      <td className="px-4 py-3">{r.macrostate}</td>
                      <td className="px-4 py-3">
                        {feeLabel(fee?.fee_prevista, "prevista")}
                      </td>
                      <td className="px-4 py-3">
                        {feeLabel(fee?.fee_maturata, "maturata")}
                      </td>
                      <td className="px-4 py-3">
                        {new Date(r.updated_at).toLocaleString("it-IT")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
