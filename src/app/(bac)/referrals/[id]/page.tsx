/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ReferralDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const { data: referral, error } = await supabase
    .schema("partner")
    .from("referrals")
    .select(
      "id, code, company_name, vat_number, contact_name, contact_email, macrostate, outcome, outcome_at, window_end, sync_status, created_at, updated_at, notes, product, relationship_nature",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (error || !referral) notFound();

  const { data: deals } = await supabase
    .schema("partner")
    .from("referral_deals")
    .select(
      "id, mokapen_deal_id, is_primary, fee_partner, currency, signed_at, cashed_at, eligible, last_synced_at, mokapen_status_title",
    )
    .eq("referral_id", referral.id)
    .order("is_primary", { ascending: false });

  const dealIds = (deals ?? []).map((d) => d.id);
  const { data: events } = dealIds.length
    ? await supabase
        .schema("partner")
        .from("deal_stage_events")
        .select(
          "id, referral_deal_id, mokapen_status_title, macrostate, previous_macrostate, created_at",
        )
        .in("referral_deal_id", dealIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10">
      <div>
        <Link href="/referrals" className="text-sm text-trust hover:underline">
          ← Elenco
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold text-trust-dark">
          {referral.code}
        </h1>
        <p className="text-trust-dark/70">{referral.company_name}</p>
      </div>

      <section className="rounded-card bg-white p-5 shadow-soft">
        <h2 className="mb-3 font-medium text-trust-dark">Stato</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-trust-dark/55">Macrostato</dt>
            <dd>{referral.macrostate}</dd>
          </div>
          <div>
            <dt className="text-trust-dark/55">Esito</dt>
            <dd>{referral.outcome}</dd>
          </div>
          <div>
            <dt className="text-trust-dark/55">Finestra</dt>
            <dd>
              {referral.window_end
                ? new Date(referral.window_end).toLocaleDateString("it-IT")
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-trust-dark/55">Sync</dt>
            <dd>{referral.sync_status}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-card bg-white p-5 shadow-soft">
        <h2 className="mb-3 font-medium text-trust-dark">Deal collegati</h2>
        {(deals ?? []).length === 0 ? (
          <p className="text-sm text-trust-dark/55">Nessun deal collegato</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {(deals ?? []).map((d) => (
              <li
                key={d.id}
                className="border-t border-trust-dark/5 pt-3 first:border-0 first:pt-0"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <span>
                    Mokapen #{d.mokapen_deal_id}
                    {d.is_primary ? " · primario" : ""}
                  </span>
                  <span>{d.mokapen_status_title ?? "—"}</span>
                </div>
                <div className="mt-1 text-trust-dark/65">
                  Fee:{" "}
                  {d.fee_partner != null
                    ? `€ ${Number(d.fee_partner).toLocaleString("it-IT")}`
                    : "—"}
                  {d.cashed_at ? " · maturata" : " · prevista"}
                  {" · "}
                  Eleggibilità:{" "}
                  {d.eligible == null
                    ? "n/d"
                    : d.eligible
                      ? "sì"
                      : "no (fuori finestra)"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card bg-white p-5 shadow-soft">
        <h2 className="mb-3 font-medium text-trust-dark">
          Cronologia macrostati
        </h2>
        {(events ?? []).length === 0 ? (
          <p className="text-sm text-trust-dark/55">Nessun evento di fase</p>
        ) : (
          <ol className="space-y-2 text-sm">
            {(events ?? []).map((ev) => (
              <li key={ev.id} className="flex justify-between gap-3">
                <span>
                  {ev.previous_macrostate ?? "—"} →{" "}
                  <strong>{ev.macrostate}</strong>
                  <span className="text-trust-dark/55">
                    {" "}
                    ({ev.mokapen_status_title})
                  </span>
                </span>
                <span className="shrink-0 text-trust-dark/55">
                  {new Date(ev.created_at).toLocaleString("it-IT")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <form action={`/api/referrals/${referral.id}/dispute`} method="post">
        <button
          type="submit"
          className="rounded-control border border-equity/40 px-3 py-2 text-sm text-equity"
          formAction="#"
          disabled
          title="Contestazione — collegata in Fase 4"
        >
          Apri contestazione (prossimamente)
        </button>
      </form>
    </div>
  );
}
