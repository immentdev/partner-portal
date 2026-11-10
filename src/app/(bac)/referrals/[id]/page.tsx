/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusPill } from "@/components/ui/StatusPill";
import { formatMoney, macrostateLabel } from "@/lib/ui/labels";

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

  const primaryFee = (deals ?? []).find((d) => d.is_primary)?.fee_partner;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/referrals"
          className="text-[13px] text-[var(--muted)] hover:text-[var(--text)]"
        >
          ← Elenco segnalazioni
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="page-title">{referral.code}</h1>
            <p className="page-sub">{referral.company_name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill value={referral.macrostate} />
            {primaryFee != null ? (
              <span className="num text-[18px] font-semibold text-[var(--text)]">
                {formatMoney(primaryFee)}
                <span className="ml-1 text-[12px] font-normal text-[var(--muted)]">
                  fee
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <section className="panel p-5">
        <h2 className="mb-4 text-[16px] font-medium text-[var(--text)]">Stato</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-[12px] text-[var(--muted)]">Macrostato</dt>
            <dd className="mt-1">
              <StatusPill value={referral.macrostate} />
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--muted)]">Esito</dt>
            <dd className="mt-1 text-[14px]">{referral.outcome ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--muted)]">Finestra</dt>
            <dd className="mt-1 text-[14px]">
              {referral.window_end
                ? new Date(referral.window_end).toLocaleDateString("it-IT")
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-[var(--muted)]">Sync Mokapen</dt>
            <dd className="mt-1 text-[14px]">{referral.sync_status ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="mb-4 text-[16px] font-medium text-[var(--text)]">
            Contatto e prodotto
          </h2>
          <dl className="space-y-3 text-[14px]">
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--muted)]">P.IVA</dt>
              <dd className="num text-right">{referral.vat_number ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--muted)]">Referente</dt>
              <dd className="text-right">{referral.contact_name ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--muted)]">Email</dt>
              <dd className="text-right">{referral.contact_email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[var(--muted)]">Prodotto</dt>
              <dd className="text-right">{referral.product ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="panel p-5">
          <h2 className="mb-4 text-[16px] font-medium text-[var(--text)]">
            Deal collegati
          </h2>
          {(deals ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed border-[var(--control)] px-3 py-6 text-center text-[13px] text-[var(--muted)]">
              Nessun deal collegato ancora.
            </p>
          ) : (
            <ul className="space-y-3 text-[14px]">
              {(deals ?? []).map((d) => (
                <li
                  key={d.id}
                  className="border-t border-[var(--rule)] pt-3 first:border-0 first:pt-0"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">
                      Mokapen #{d.mokapen_deal_id}
                      {d.is_primary ? (
                        <span className="ml-2 text-[12px] font-normal text-[var(--muted)]">
                          primario
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[var(--muted)]">
                      {d.mokapen_status_title ?? "—"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap justify-between gap-2 text-[13px] text-[var(--muted)]">
                    <span className="num text-[var(--text)]">
                      Fee {formatMoney(d.fee_partner)}
                      <span className="text-[var(--muted)]">
                        {d.cashed_at ? " · maturata" : " · prevista"}
                      </span>
                    </span>
                    <span>
                      Eleggibilità:{" "}
                      {d.eligible == null
                        ? "n/d"
                        : d.eligible
                          ? "sì"
                          : "no (fuori finestra)"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel p-5">
        <h2 className="mb-4 text-[16px] font-medium text-[var(--text)]">
          Cronologia macrostati
        </h2>
        {(events ?? []).length === 0 ? (
          <p className="rounded-lg border border-dashed border-[var(--control)] px-3 py-6 text-center text-[13px] text-[var(--muted)]">
            Nessun evento di fase registrato.
          </p>
        ) : (
          <ol className="space-y-0">
            {(events ?? []).map((ev) => (
              <li
                key={ev.id}
                className="flex flex-wrap items-baseline justify-between gap-3 border-t border-[var(--rule)] py-3 first:border-0 first:pt-0"
              >
                <span className="text-[14px]">
                  <span className="text-[var(--muted)]">
                    {macrostateLabel(ev.previous_macrostate)}
                  </span>
                  {" → "}
                  <strong className="font-medium">
                    {macrostateLabel(ev.macrostate)}
                  </strong>
                  <span className="text-[var(--faint)]">
                    {" "}
                    ({ev.mokapen_status_title})
                  </span>
                </span>
                <span className="shrink-0 text-[12px] text-[var(--faint)]">
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
          className="btn-secondary text-[var(--equity)]"
          formAction="#"
          disabled
          title="Contestazione, collegata in Fase 4"
          style={{ color: "var(--equity)", borderColor: "rgba(211,0,131,0.35)" }}
        >
          Apri contestazione (prossimamente)
        </button>
      </form>
    </div>
  );
}
