/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import { createClient } from "@/lib/supabase/server";

export default async function AdminHomePage() {
  const supabase = createClient();
  const { count } = await supabase
    .schema("partner")
    .from("anomalies")
    .select("id", { count: "exact", head: true })
    .eq("status", "open");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-2xl font-semibold text-trust-dark">
        Admin Imment
      </h1>
      <p className="mt-2 text-sm text-trust-dark/65">
        Anomalie aperte: {count ?? 0}
      </p>
    </div>
  );
}
