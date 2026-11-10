/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminHomePage() {
  const supabase = createClient();
  const { count } = await supabase
    .schema("partner")
    .from("anomalies")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");

  const open = count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Admin Imment</h1>
        <p className="page-sub">
          {open === 0
            ? "Nessuna anomalia aperta in coda."
            : `${open} anomalie aperte richiedono attenzione.`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="panel p-5">
          <p className="text-[12px] text-[var(--muted)]">Anomalie aperte</p>
          <p className="num mt-2 text-[28px] font-semibold leading-none text-[var(--text)]">
            {open}
          </p>
          <p className="mt-3 text-[13px] text-[var(--faint)]">
            Sync Mokapen, eleggibilità fee, incongruenze di stato.
          </p>
        </section>
        <section className="panel flex flex-col justify-between p-5">
          <div>
            <p className="text-[12px] text-[var(--muted)]">Azioni rapide</p>
            <p className="mt-2 text-[14px] text-[var(--text)]">
              Vai alle segnalazioni per verificare fee e macrostati.
            </p>
          </div>
          <Link href="/referrals" className="btn-primary mt-4 self-start">
            Apri segnalazioni
          </Link>
        </section>
      </div>
    </div>
  );
}
