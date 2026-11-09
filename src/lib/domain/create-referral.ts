/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 *
 * Orchestrazione server-side della segnalazione (scritture solo service role).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/audit";
import { openAnomaly } from "@/lib/domain/anomalies";
import {
  createReferralSchema,
  normalizeVat,
  type CreateReferralInput,
} from "@/lib/domain/referral-schema";
import { sendReferralConfirmation } from "@/lib/email/referral-confirmation";
import { createReferralOnMokapen } from "@/lib/mokapen/create-referral-deal";
import { partnerDb } from "@/lib/supabase/partner";
import type { Profile } from "@/lib/auth/roles";

export type CreateReferralResult = {
  referralId: string;
  code: string;
  syncStatus: "synced" | "stalled" | "pending";
  message: string;
  possibleDuplicate: boolean;
};

function buildReferralCode(territoryCode: string) {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `REF-${territoryCode}-${day}-${rand}`;
}

export async function createReferral(opts: {
  admin: SupabaseClient;
  profile: Profile;
  body: unknown;
}): Promise<CreateReferralResult> {
  if (opts.profile.role !== "bac_locale") {
    throw Object.assign(new Error("Solo i coordinatori BAC Locale possono segnalare"), {
      status: 403,
    });
  }
  if (!opts.profile.territory_id || !opts.profile.partner_org_id) {
    throw Object.assign(new Error("Profilo incompleto: territorio/organizzazione mancanti"), {
      status: 400,
    });
  }

  const parsed: CreateReferralInput = createReferralSchema.parse(opts.body);
  const vat = normalizeVat(parsed.vat_number);
  const vatStored = vat.length === 11 ? `IT${vat}` : parsed.vat_number;

  const db = partnerDb(opts.admin);

  const { data: territory, error: terrErr } = await db
    .from("territories")
    .select("id, code, partner_org_id")
    .eq("id", opts.profile.territory_id)
    .single();
  if (terrErr || !territory) {
    throw Object.assign(new Error("Territorio non trovato"), { status: 400 });
  }

  const { data: org } = await db
    .from("partner_orgs")
    .select("id, mokapen_company_id")
    .eq("id", opts.profile.partner_org_id)
    .single();

  // Duplicati portale
  const { data: portalDupes } = await db
    .from("referrals")
    .select("id, code")
    .eq("vat_number", vatStored)
    .is("cancelled_at", null)
    .limit(5);

  const code = buildReferralCode(territory.code);

  const { data: referral, error: refErr } = await db
    .from("referrals")
    .insert({
      code,
      partner_org_id: opts.profile.partner_org_id,
      territory_id: opts.profile.territory_id,
      created_by: opts.profile.id,
      company_name: parsed.company_name,
      vat_number: vatStored,
      website: parsed.website ?? null,
      contact_name: parsed.contact_name,
      contact_email: parsed.contact_email,
      contact_phone: parsed.contact_phone ?? null,
      product: parsed.product ?? null,
      relationship_nature: parsed.relationship_nature ?? null,
      notes: parsed.notes ?? null,
      sync_status: "pending",
      macrostate: "in_valutazione",
      outcome: "pending",
    })
    .select("id, code")
    .single();
  if (refErr || !referral) throw refErr ?? new Error("Insert referral fallito");

  let possibleDuplicate = (portalDupes?.length ?? 0) > 0;
  let syncStatus: "synced" | "stalled" | "pending" = "pending";
  let mokapenDealId: number | null = null;

  try {
    const mok = await createReferralOnMokapen({
      companyName: parsed.company_name,
      vatNumber: vatStored,
      website: parsed.website,
      contactName: parsed.contact_name,
      contactEmail: parsed.contact_email,
      contactPhone: parsed.contact_phone,
      product: parsed.product,
      relationshipNature: parsed.relationship_nature,
      notes: parsed.notes,
      referralCode: code,
      territoryCode: territory.code,
      partnerCompanyId: org?.mokapen_company_id ?? null,
      referrerContactId: opts.profile.mokapen_contact_id,
    });

    possibleDuplicate = possibleDuplicate || mok.mokapenDuplicateHit;
    mokapenDealId = mok.dealId;

    await db.from("referral_deals").insert({
      referral_id: referral.id,
      mokapen_deal_id: mok.dealId,
      is_primary: true,
      mokapen_status_id: 18713,
      mokapen_status_title: "Nuovo lead",
      last_synced_at: new Date().toISOString(),
    });

    await db
      .from("referrals")
      .update({ sync_status: "synced" })
      .eq("id", referral.id);

    syncStatus = "synced";
  } catch (err) {
    console.error("[createReferral] Mokapen sync failed", err);
    await db
      .from("referrals")
      .update({ sync_status: "stalled" })
      .eq("id", referral.id);
    syncStatus = "stalled";

    await openAnomaly(opts.admin, {
      type: "sync_stalled",
      title: `Sync Mokapen fallita — ${code}`,
      detail: err instanceof Error ? err.message : String(err),
      referral_id: referral.id,
    }).catch((e) => console.error("[anomaly] sync_stalled", e));

    // Un retry immediato (best effort)
    try {
      const mok = await createReferralOnMokapen({
        companyName: parsed.company_name,
        vatNumber: vatStored,
        website: parsed.website,
        contactName: parsed.contact_name,
        contactEmail: parsed.contact_email,
        contactPhone: parsed.contact_phone,
        product: parsed.product,
        relationshipNature: parsed.relationship_nature,
        notes: parsed.notes,
        referralCode: code,
        territoryCode: territory.code,
        partnerCompanyId: org?.mokapen_company_id ?? null,
        referrerContactId: opts.profile.mokapen_contact_id,
      });
      mokapenDealId = mok.dealId;
      possibleDuplicate = possibleDuplicate || mok.mokapenDuplicateHit;
      await db.from("referral_deals").insert({
        referral_id: referral.id,
        mokapen_deal_id: mok.dealId,
        is_primary: true,
        mokapen_status_id: 18713,
        mokapen_status_title: "Nuovo lead",
        last_synced_at: new Date().toISOString(),
      });
      await db
        .from("referrals")
        .update({ sync_status: "synced" })
        .eq("id", referral.id);
      syncStatus = "synced";
    } catch (retryErr) {
      console.error("[createReferral] retry failed", retryErr);
    }
  }

  if (possibleDuplicate) {
    await openAnomaly(opts.admin, {
      type: "possible_duplicate",
      title: `Possibile duplicato P.IVA ${vatStored}`,
      detail: `Referral ${code}. Match portale: ${(portalDupes ?? [])
        .map((d) => d.code)
        .join(", ") || "nessuno"}.`,
      referral_id: referral.id,
    }).catch((e) => console.error("[anomaly] possible_duplicate", e));
  }

  await writeAudit(opts.admin, {
    actor_id: opts.profile.id,
    action: "referral.create",
    entity_type: "referral",
    entity_id: referral.id,
    meta: {
      code,
      vat: vatStored,
      sync_status: syncStatus,
      mokapen_deal_id: mokapenDealId,
      possible_duplicate: possibleDuplicate,
    },
  }).catch((e) => console.error("[audit]", e));

  await sendReferralConfirmation({
    to: opts.profile.email,
    companyName: parsed.company_name,
    referralCode: code,
    syncPending: syncStatus !== "synced",
  }).catch((e) => console.error("[email]", e));

  return {
    referralId: referral.id,
    code,
    syncStatus,
    possibleDuplicate,
    message:
      syncStatus === "synced"
        ? "Segnalazione inviata e registrata su Mokapen."
        : "Segnalazione inviata, in registrazione sul CRM.",
  };
}
