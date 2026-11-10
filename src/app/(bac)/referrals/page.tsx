/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/roles";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatFee } from "@/lib/ui/labels";

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
  const isNazionale =
    role === "bac_nazionale" ||
    role === "super_admin" ||
    role === "imment_admin";

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
    : {
        data: [] as Array<{
          referral_id: string;
          fee_prevista: number;
          fee_maturata: number;
        }>,
      };

  const feeByReferral = new Map((fees ?? []).map((f) => [f.referral_id, f]));

  const { data: territories } = isNazionale
    ? await supabase
        .schema("partner")
        .from("territories")
        .select("id, code, name")
        .order("code")
    : { data: [] as Array<{ id: string; code: string; name: string }> };

  const total = (referrals ?? []).length;
  const activeCount = (referrals ?? []).filter(
    (r) => r.macrostate === "incarico_attivo",
  ).length;
  const reviewingCount = (referrals ?? []).filter(
    (r) => r.macrostate === "in_valutazione",
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Segnalazioni</h1>
          <p className="page-sub">
            Pipeline commerciale BAC, stati Mokapen e fee partner.
          </p>
        </div>
        <Link href="/referrals/new" className="btn-primary">
          Nuova segnalazione
        </Link>
      </div>

      <dl className="grid grid-cols-1 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] sm:grid-cols-3">
        <div className="px-4 py-3.5">
          <dt className="text-[13px] text-[var(--muted)]">In elenco</dt>
          <dd className="num mt-1.5 text-[24px] font-semibold leading-none">
            {total}
          </dd>
        </div>
        <div className="border-t border-[var(--border)] px-4 py-3.5 sm:border-l sm:border-t-0">
          <dt className="text-[13px] text-[var(--muted)]">Incarico attivo</dt>
          <dd className="num mt-1.5 text-[24px] font-semibold leading-none">
            {activeCount}
          </dd>
        </div>
        <div className="border-t border-[var(--border)] px-4 py-3.5 sm:border-l sm:border-t-0">
          <dt className="text-[13px] text-[var(--muted)]">In valutazione</dt>
          <dd className="num mt-1.5 text-[24px] font-semibold leading-none">
            {reviewingCount}
          </dd>
        </div>
      </dl>

      {isNazionale ? (
        <form className="flex flex-wrap items-end gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--raised)] p-4">
          <label className="space-y-1 text-[13px] text-[var(--muted)]">
            <span className="block">Territorio</span>
            <select
              name="territory"
              defaultValue={searchParams.territory ?? ""}
              className="field-input min-w-[160px]"
            >
              <option value="">Tutti</option>
              {(territories ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} · {t.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[13px] text-[var(--muted)]">
            <span className="block">Macrostato</span>
            <select
              name="macrostate"
              defaultValue={searchParams.macrostate ?? ""}
              className="field-input min-w-[180px]"
            >
              <option value="">Tutti</option>
              <option value="in_valutazione">In valutazione</option>
              <option value="non_accettato">Non accettato</option>
              <option value="proposta_inviata">Proposta inviata</option>
              <option value="incarico_attivo">Incarico attivo</option>
              <option value="chiuso_non_acquisito">Chiuso non acquisito</option>
            </select>
          </label>
          <label className="space-y-1 text-[13px] text-[var(--muted)]">
            <span className="block">Dal</span>
            <input
              type="date"
              name="from"
              defaultValue={searchParams.from ?? ""}
              className="field-input"
            />
          </label>
          <label className="space-y-1 text-[13px] text-[var(--muted)]">
            <span className="block">Al</span>
            <input
              type="date"
              name="to"
              defaultValue={searchParams.to ?? ""}
              className="field-input"
            />
          </label>
          <button type="submit" className="btn-primary">
            Filtra
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="text-[13px] text-[var(--negative)]">{error.message}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr>
                <th className="table-head table-cell">Codice</th>
                <th className="table-head table-cell">Startup</th>
                {isNazionale ? (
                  <th className="table-head table-cell">Territorio</th>
                ) : null}
                <th className="table-head table-cell">Macrostato</th>
                <th className="table-head table-cell text-right">Fee prevista</th>
                <th className="table-head table-cell text-right">Fee maturata</th>
                <th className="table-head table-cell text-right">Aggiornato</th>
              </tr>
            </thead>
            <tbody>
              {(referrals ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={isNazionale ? 7 : 6}
                    className="border border-dashed border-[var(--control)] px-4 py-8 text-center text-[14px] text-[var(--muted)]"
                  >
                    Nessuna segnalazione in questo filtro. Apri una nuova
                    segnalazione per avviare il pipeline.
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
                    <tr
                      key={r.id}
                      className="border-t border-[var(--rule)] hover:bg-[var(--raised)]/60"
                    >
                      <td className="table-cell">
                        <Link
                          className="font-medium text-[var(--text)] underline-offset-2 hover:underline"
                          href={`/referrals/${r.id}`}
                        >
                          {r.code}
                        </Link>
                      </td>
                      <td className="table-cell font-medium text-[var(--text)]">
                        {r.company_name}
                      </td>
                      {isNazionale ? (
                        <td className="table-cell">
                          <span className="rounded px-1.5 py-0.5 text-[12px] font-medium text-[var(--muted)] bg-[var(--raised)]">
                            {terrLabel ?? "—"}
                          </span>
                        </td>
                      ) : null}
                      <td className="table-cell">
                        <StatusPill value={r.macrostate} />
                      </td>
                      <td className="table-cell num text-right text-[var(--text)]">
                        {formatFee(fee?.fee_prevista, "prevista")}
                      </td>
                      <td className="table-cell num text-right text-[var(--muted)]">
                        {formatFee(fee?.fee_maturata, "maturata")}
                      </td>
                      <td className="table-cell text-right text-[13px] text-[var(--faint)]">
                        {new Date(r.updated_at).toLocaleDateString("it-IT")}
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
