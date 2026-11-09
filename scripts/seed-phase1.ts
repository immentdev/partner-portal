/**
 * Partner Portal BAC × Imment — seed Fase 1
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 *
 * Crea Associazione BAC, 2 territori pilota e utenti di test.
 * Richiede SUPABASE_SERVICE_ROLE_KEY.
 *
 *   npm run seed:phase1
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) {
  throw new Error(
    "Servono NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY (sb_secret_...)",
  );
}

const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_PASSWORD = process.env.SEED_TEST_PASSWORD || "PartnerPortal!Test1";

type SeedUser = {
  email: string;
  full_name: string;
  role: "super_admin" | "imment_admin" | "bac_nazionale" | "bac_locale";
  territory_code?: string;
  is_emergency?: boolean;
};

async function upsertOrg() {
  const db = admin.schema("partner");
  const { data: existing } = await db
    .from("partner_orgs")
    .select("id")
    .eq("code", "BAC-NAZ")
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await db
    .from("partner_orgs")
    .insert({
      name: "Associazione Business Angel Club",
      code: "BAC-NAZ",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function upsertTerritory(
  partnerOrgId: string,
  name: string,
  code: string,
) {
  const db = admin.schema("partner");
  const { data: existing } = await db
    .from("territories")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await db
    .from("territories")
    .insert({ partner_org_id: partnerOrgId, name, code })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function ensureUser(u: SeedUser, partnerOrgId: string, territories: Record<string, string>) {
  const list = await admin.auth.admin.listUsers({ perPage: 200 });
  let user = list.data.users.find(
    (x) => x.email?.toLowerCase() === u.email.toLowerCase(),
  );

  if (!user) {
    const created = await admin.auth.admin.createUser({
      email: u.email,
      password: TEST_PASSWORD,
      email_confirm: true,
      app_metadata: { role: u.role },
    });
    if (created.error) throw created.error;
    user = created.data.user;
  }

  const territory_id = u.territory_code
    ? territories[u.territory_code] ?? null
    : null;

  const { error } = await admin.schema("partner").from("profiles").upsert(
    {
      id: user!.id,
      email: u.email,
      full_name: u.full_name,
      role: u.role,
      partner_org_id:
        u.role === "bac_locale" || u.role === "bac_nazionale"
          ? partnerOrgId
          : null,
      territory_id,
      is_emergency: u.is_emergency ?? false,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
  return user!.id;
}

async function seedSampleReferrals(
  partnerOrgId: string,
  territories: Record<string, string>,
  createdBy: string,
) {
  const samples = [
    {
      code: "REF-PILOTA-A-001",
      territory_id: territories["BAC-MI"]!,
      company_name: "Startup Alfa SRL",
      vat_number: "IT11111111111",
    },
    {
      code: "REF-PILOTA-B-001",
      territory_id: territories["BAC-RM"]!,
      company_name: "Startup Beta SRL",
      vat_number: "IT22222222222",
    },
  ];

  for (const s of samples) {
    const db = admin.schema("partner");
    const { data: existing } = await db
      .from("referrals")
      .select("id")
      .eq("code", s.code)
      .maybeSingle();
    if (existing) continue;

    const { data: referral, error } = await db
      .from("referrals")
      .insert({
        ...s,
        partner_org_id: partnerOrgId,
        created_by: createdBy,
        contact_name: "Referente Test",
        contact_email: "referente@example.com",
        sync_status: "synced",
      })
      .select("id")
      .single();
    if (error) throw error;

    await db.from("referral_deals").insert({
      referral_id: referral.id,
      mokapen_deal_id: s.code.endsWith("A-001") ? 900001 : 900002,
      is_primary: true,
      deal_amount: 50000,
      fee_partner: 5000,
      currency: "EUR",
      mokapen_status_id: 18713,
      mokapen_status_title: "Nuovo lead",
      mokapen_stage_raw: { smoke: true },
    });
  }
}

async function main() {
  console.log("Seed Fase 1…");
  const orgId = await upsertOrg();
  const territories = {
    "BAC-MI": await upsertTerritory(orgId, "BAC Milano", "BAC-MI"),
    "BAC-RM": await upsertTerritory(orgId, "BAC Roma", "BAC-RM"),
  };

  const users: SeedUser[] = [
    {
      email: "giuseppe@imment.it",
      full_name: "Giuseppe Pistoia",
      role: "super_admin",
    },
    {
      email: "admin@imment.it",
      full_name: "Emergency Admin",
      role: "super_admin",
      is_emergency: true,
    },
    {
      email: "pp@imment.it",
      full_name: "Responsabile PP",
      role: "imment_admin",
    },
    {
      email: "nazionale@bac.test",
      full_name: "Referente Nazionale",
      role: "bac_nazionale",
    },
    {
      email: "milano@bac.test",
      full_name: "Coordinatore Milano",
      role: "bac_locale",
      territory_code: "BAC-MI",
    },
    {
      email: "roma@bac.test",
      full_name: "Coordinatore Roma",
      role: "bac_locale",
      territory_code: "BAC-RM",
    },
  ];

  const ids: Record<string, string> = {};
  for (const u of users) {
    ids[u.email] = await ensureUser(u, orgId, territories);
    console.log(`  user ${u.email} (${u.role})`);
  }

  await seedSampleReferrals(orgId, territories, ids["milano@bac.test"]!);

  console.log("\nPassword utenti test:", TEST_PASSWORD);
  console.log("Seed completato.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
