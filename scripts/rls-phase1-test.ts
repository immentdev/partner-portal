/**
 * Partner Portal BAC × Imment — test RLS Fase 1
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 *
 * Verifica:
 * - territorio A non vede referral di B
 * - BAC non legge deal_amount (colonna non esposta)
 *
 *   npm run test:rls
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const password = process.env.SEED_TEST_PASSWORD || "PartnerPortal!Test1";

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];

function record(name: string, ok: boolean, detail: string) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}: ${detail}`);
}

async function clientAs(email: string) {
  const client = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login ${email}: ${error.message}`);
  return client;
}

async function main() {
  if (!url || !anon) {
    throw new Error("Mancano NEXT_PUBLIC_SUPABASE_URL / ANON_KEY");
  }

  const milano = await clientAs("milano@bac.test");
  const roma = await clientAs("roma@bac.test");
  const nazionale = await clientAs("nazionale@bac.test");

  const { data: miRefs } = await milano
    .schema("partner")
    .from("referrals")
    .select("code, territory_id");
  const { data: rmRefs } = await roma
    .schema("partner")
    .from("referrals")
    .select("code, territory_id");
  const { data: nazRefs } = await nazionale
    .schema("partner")
    .from("referrals")
    .select("code");

  const miCodes = (miRefs ?? []).map((r) => r.code);
  const rmCodes = (rmRefs ?? []).map((r) => r.code);
  const nazCodes = (nazRefs ?? []).map((r) => r.code);

  record(
    "milano_isolation",
    miCodes.includes("REF-PILOTA-A-001") && !miCodes.includes("REF-PILOTA-B-001"),
    `vede ${miCodes.join(",") || "(nessuno)"}`,
  );
  record(
    "roma_isolation",
    rmCodes.includes("REF-PILOTA-B-001") && !rmCodes.includes("REF-PILOTA-A-001"),
    `vede ${rmCodes.join(",") || "(nessuno)"}`,
  );
  record(
    "nazionale_sees_both",
    nazCodes.includes("REF-PILOTA-A-001") && nazCodes.includes("REF-PILOTA-B-001"),
    `vede ${nazCodes.join(",") || "(nessuno)"}`,
  );

  // deal_amount: richiesta esplicita della colonna deve fallire o tornare null senza valore
  const { data: deals, error: dealErr } = await milano
    .schema("partner")
    .from("referral_deals")
    .select("id, fee_partner, deal_amount");

  if (dealErr) {
    record(
      "deal_amount_blocked",
      /deal_amount|permission|column/i.test(dealErr.message),
      dealErr.message,
    );
  } else {
    const leaked = (deals ?? []).some(
      (d) =>
        d &&
        typeof d === "object" &&
        "deal_amount" in d &&
        (d as { deal_amount: unknown }).deal_amount != null,
    );
    record(
      "deal_amount_blocked",
      !leaked,
      leaked
        ? "deal_amount visibile al BAC"
        : `fee_partner ok, deal_amount assente/null (rows=${deals?.length ?? 0})`,
    );
  }

  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${checks.length - failed.length}/${checks.length} pass`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
