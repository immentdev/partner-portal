/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 *
 * Allinea un deal Mokapen al portale (webhook + riconciliazione).
 * Il payload webhook non è attendibile: si lavora sempre sul GET deal.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/audit";
import { openAnomaly } from "@/lib/domain/anomalies";
import { addMonths, computeEligible } from "@/lib/domain/eligibility";
import {
  MOKAPEN_FEE_FIELD,
  STAGE_BY_ID,
  type Macrostate,
  type PartnerStageId,
  isPartnerStageId,
  macrostateForStageId,
} from "@/lib/domain/macrostate";
import { sendMacrostateChangeEmail } from "@/lib/email/macrostate-change";
import { MokapenClient, readDeal, type MokapenDeal } from "@/lib/mokapen";
import { partnerDb } from "@/lib/supabase/partner";

const INCASSATO_ID = 18828;

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function stageIdOf(deal: MokapenDeal): number | null {
  return num(deal.status_id);
}

function feeOf(deal: MokapenDeal): number | null {
  return num(deal[MOKAPEN_FEE_FIELD] ?? deal.importo_success_fee);
}

function amountOf(deal: MokapenDeal): number | null {
  return num(deal.amount);
}

export type SyncDealResult = {
  referralDealId: string | null;
  referralId: string | null;
  stageChanged: boolean;
  macrostateChanged: boolean;
  statusId: number | null;
  macrostate: Macrostate | null;
};

export async function syncDealByMokapenId(
  admin: SupabaseClient,
  mokapenDealId: number,
  opts: { event?: "deal.created" | "deal.updated" | "reconcile" } = {},
): Promise<SyncDealResult> {
  const client = MokapenClient.fromEnv();
  const deal = await readDeal(client, mokapenDealId);
  return applyMokapenDeal(admin, deal, opts);
}

export async function applyMokapenDeal(
  admin: SupabaseClient,
  deal: MokapenDeal,
  opts: { event?: "deal.created" | "deal.updated" | "reconcile" } = {},
): Promise<SyncDealResult> {
  const db = partnerDb(admin);
  const mokapenDealId = num(deal.deal_id ?? deal.id);
  if (!mokapenDealId) {
    throw new Error("Deal Mokapen senza id");
  }

  const statusId = stageIdOf(deal);
  const stageMeta =
    statusId != null && isPartnerStageId(statusId)
      ? STAGE_BY_ID[statusId]
      : null;
  const nextMacro = macrostateForStageId(statusId);
  const feePartner = feeOf(deal);
  const dealAmount = amountOf(deal);
  const stageTitle =
    stageMeta?.title ??
    (typeof deal.status_title === "string" ? deal.status_title : "Sconosciuta");

  const { data: linked } = await db
    .from("referral_deals")
    .select(
      "id, referral_id, mokapen_status_id, fee_partner, deal_amount, signed_at, cashed_at, eligible",
    )
    .eq("mokapen_deal_id", mokapenDealId)
    .maybeSingle();

  // deal.created non collegato: possibile unlinked_deal
  if (!linked && opts.event === "deal.created") {
    await maybeOpenUnlinkedDeal(admin, deal, mokapenDealId);
    await touchSyncState(admin, { last_webhook_at: new Date().toISOString() });
    return {
      referralDealId: null,
      referralId: null,
      stageChanged: false,
      macrostateChanged: false,
      statusId,
      macrostate: nextMacro,
    };
  }

  if (!linked) {
    return {
      referralDealId: null,
      referralId: null,
      stageChanged: false,
      macrostateChanged: false,
      statusId,
      macrostate: nextMacro,
    };
  }

  const { data: referral } = await db
    .from("referrals")
    .select(
      "id, code, company_name, macrostate, outcome, outcome_at, window_end, territory_id, created_by",
    )
    .eq("id", linked.referral_id)
    .single();

  if (!referral) {
    throw new Error(`Referral ${linked.referral_id} non trovato`);
  }

  const prevStatusId = linked.mokapen_status_id
    ? Number(linked.mokapen_status_id)
    : null;
  const prevMacro = referral.macrostate as Macrostate;
  const stageChanged = statusId != null && statusId !== prevStatusId;
  const macrostateChanged =
    nextMacro != null && nextMacro !== prevMacro && stageChanged;

  // Regressione da Incassato
  const leftIncassato =
    prevStatusId === INCASSATO_ID &&
    statusId != null &&
    statusId !== INCASSATO_ID;

  const nowIso = new Date().toISOString();
  let signedAt = linked.signed_at as string | null;
  let cashedAt = linked.cashed_at as string | null;
  let windowEnd = referral.window_end as string | null;
  let outcome = referral.outcome as string;
  let outcomeAt = referral.outcome_at as string | null;

  const effects: readonly string[] =
    statusId != null && isPartnerStageId(statusId)
      ? STAGE_BY_ID[statusId as PartnerStageId].effects
      : [];

  if (stageChanged) {
    if (effects.includes("accept")) {
      outcome = "accepted";
      outcomeAt = nowIso;
      windowEnd = addMonths(nowIso, 12);
    }
    if (effects.includes("reject")) {
      outcome = "rejected";
      outcomeAt = nowIso;
    }
    if (effects.includes("existing")) {
      outcome = "existing";
      outcomeAt = nowIso;
    }
    if (effects.includes("signed")) {
      signedAt = signedAt ?? nowIso;
    }
    if (effects.includes("cashed")) {
      cashedAt = nowIso;
    }
  }

  if (leftIncassato) {
    cashedAt = null;
    await openAnomaly(admin, {
      type: "stage_regression",
      title: `Regressione da Incassato — deal ${mokapenDealId}`,
      detail: `Referral ${referral.code}: status ${prevStatusId} → ${statusId}`,
      referral_id: referral.id,
      referral_deal_id: linked.id,
    }).catch((e) => console.error("[anomaly] stage_regression", e));
  }

  const eligible = computeEligible(signedAt, windowEnd);

  // Fee diminuita dopo incasso
  const prevFee = num(linked.fee_partner);
  if (
    cashedAt &&
    feePartner != null &&
    prevFee != null &&
    feePartner < prevFee
  ) {
    await openAnomaly(admin, {
      type: "fee_decreased",
      title: `Fee diminuita dopo incasso — ${referral.code}`,
      detail: `${prevFee} → ${feePartner}`,
      referral_id: referral.id,
      referral_deal_id: linked.id,
    }).catch((e) => console.error("[anomaly] fee_decreased", e));
  }

  // Deal fuori finestra
  if (signedAt && windowEnd && eligible === false) {
    await openAnomaly(admin, {
      type: "deal_out_of_window",
      title: `Deal fuori finestra — ${referral.code}`,
      detail: `signed_at=${signedAt}, window_end=${windowEnd}`,
      referral_id: referral.id,
      referral_deal_id: linked.id,
    }).catch((e) => console.error("[anomaly] deal_out_of_window", e));
  }

  await db
    .from("referral_deals")
    .update({
      mokapen_status_id: statusId,
      mokapen_status_title: stageTitle,
      mokapen_stage_raw: deal,
      deal_amount: dealAmount,
      fee_partner: feePartner,
      signed_at: signedAt,
      cashed_at: cashedAt,
      eligible,
      last_synced_at: nowIso,
    })
    .eq("id", linked.id);

  if (stageChanged || nextMacro) {
    await db
      .from("referrals")
      .update({
        macrostate: nextMacro ?? prevMacro,
        outcome,
        outcome_at: outcomeAt,
        window_end: windowEnd,
        updated_at: nowIso,
      })
      .eq("id", referral.id);
  }

  if (stageChanged && statusId != null) {
    await db.from("deal_stage_events").insert({
      referral_deal_id: linked.id,
      mokapen_status_id: statusId,
      mokapen_status_title: stageTitle,
      macrostate: nextMacro ?? prevMacro,
      previous_macrostate: prevMacro,
    });

    await writeAudit(admin, {
      action: "deal.stage_change",
      entity_type: "referral_deal",
      entity_id: linked.id,
      meta: {
        mokapen_deal_id: mokapenDealId,
        from_status: prevStatusId,
        to_status: statusId,
        from_macrostate: prevMacro,
        to_macrostate: nextMacro,
        event: opts.event ?? null,
      },
    }).catch((e) => console.error("[audit]", e));
  }

  if (macrostateChanged && nextMacro) {
    const toEmail = await resolveBacLocaleEmail(admin, referral.territory_id);
    if (toEmail) {
      await sendMacrostateChangeEmail({
        to: toEmail,
        companyName: referral.company_name,
        referralCode: referral.code,
        previous: prevMacro,
        next: nextMacro,
        stageTitle,
      }).catch((e) => console.error("[email] macrostate", e));
    }
  }

  if (opts.event === "deal.created" || opts.event === "deal.updated") {
    await touchSyncState(admin, { last_webhook_at: nowIso });
  }

  return {
    referralDealId: linked.id,
    referralId: referral.id,
    stageChanged,
    macrostateChanged,
    statusId,
    macrostate: nextMacro,
  };
}

async function resolveBacLocaleEmail(
  admin: SupabaseClient,
  territoryId: string,
): Promise<string | null> {
  const { data } = await partnerDb(admin)
    .from("profiles")
    .select("email")
    .eq("territory_id", territoryId)
    .eq("role", "bac_locale")
    .limit(1)
    .maybeSingle();
  return data?.email ?? null;
}

async function maybeOpenUnlinkedDeal(
  admin: SupabaseClient,
  deal: MokapenDeal,
  mokapenDealId: number,
) {
  const businessId = num(deal.business_id);
  if (!businessId) return;

  // Referral attivi con deal sulla stessa azienda Mokapen
  const { data: siblings } = await partnerDb(admin)
    .from("referral_deals")
    .select("id, referral_id, mokapen_stage_raw")
    .neq("mokapen_deal_id", mokapenDealId)
    .limit(50);

  const hit = (siblings ?? []).some((row) => {
    const raw = row.mokapen_stage_raw as { business_id?: unknown } | null;
    return num(raw?.business_id) === businessId;
  });

  // Alternativa: cerca referral con company match via deals con stesso business
  // Se non troviamo sibling con stesso business_id nello stage_raw, prova query fee deals
  if (!hit) {
    // Controlla referral_deals aggiornati che hanno deal_amount e business nello raw
    const { data: all } = await partnerDb(admin)
      .from("referral_deals")
      .select("referral_id, mokapen_deal_id")
      .limit(1);
    void all;
    // Se nessun deal collegato con stessa azienda, non aprire (troppo rumoroso senza indice company)
    // Apri solo se esiste almeno un referral_deal con stage_raw.business_id
    const { data: withBiz } = await partnerDb(admin)
      .from("referral_deals")
      .select("id, referral_id")
      .filter("mokapen_stage_raw->>business_id", "eq", String(businessId))
      .limit(1);
    if (!withBiz?.length) return;

    await openAnomaly(admin, {
      type: "unlinked_deal",
      title: `Deal Mokapen non collegato #${mokapenDealId}`,
      detail: `business_id=${businessId}. Collegamento manuale richiesto.`,
      referral_id: withBiz[0]!.referral_id,
    }).catch((e) => console.error("[anomaly] unlinked_deal", e));
    return;
  }

  const referralId = siblings?.find((row) => {
    const raw = row.mokapen_stage_raw as { business_id?: unknown } | null;
    return num(raw?.business_id) === businessId;
  })?.referral_id;

  await openAnomaly(admin, {
    type: "unlinked_deal",
    title: `Deal Mokapen non collegato #${mokapenDealId}`,
    detail: `business_id=${businessId}. Collegamento manuale richiesto.`,
    referral_id: referralId,
  }).catch((e) => console.error("[anomaly] unlinked_deal", e));
}

async function touchSyncState(
  admin: SupabaseClient,
  patch: { last_webhook_at?: string; last_reconcile_at?: string; last_error?: string | null },
) {
  await partnerDb(admin)
    .from("sync_state")
    .upsert({ id: "mokapen", ...patch, updated_at: new Date().toISOString() });
}

export async function reconcileOpenDeals(admin: SupabaseClient) {
  const db = partnerDb(admin);
  const { data: openReferrals, error: refErr } = await db
    .from("referrals")
    .select("id")
    .is("cancelled_at", null)
    .neq("macrostate", "chiuso_non_acquisito");
  if (refErr) throw refErr;

  const openIds = new Set((openReferrals ?? []).map((r) => r.id as string));
  const { data: rows, error } = await db
    .from("referral_deals")
    .select("mokapen_deal_id, referral_id");
  if (error) throw error;

  const targets = (rows ?? []).filter((r) => openIds.has(r.referral_id as string));

  let synced = 0;
  let failed = 0;
  for (const row of targets) {
    try {
      await syncDealByMokapenId(admin, Number(row.mokapen_deal_id), {
        event: "reconcile",
      });
      synced += 1;
    } catch (err) {
      failed += 1;
      console.error("[reconcile] deal", row.mokapen_deal_id, err);
      await openAnomaly(admin, {
        type: "sync_stalled",
        title: `Riconciliazione fallita deal ${row.mokapen_deal_id}`,
        detail: err instanceof Error ? err.message : String(err),
        referral_id: row.referral_id,
      }).catch(() => undefined);
    }
  }

  // Webhook assente da 7 giorni
  const { data: sync } = await db
    .from("sync_state")
    .select("last_webhook_at")
    .eq("id", "mokapen")
    .maybeSingle();
  if (sync?.last_webhook_at) {
    const age =
      Date.now() - new Date(sync.last_webhook_at as string).getTime();
    if (age > 7 * 24 * 60 * 60 * 1000) {
      await openAnomaly(admin, {
        type: "sync_stalled",
        title: "Nessun webhook Mokapen da 7 giorni",
        detail: `last_webhook_at=${sync.last_webhook_at}`,
      }).catch(() => undefined);
    }
  }

  await touchSyncState(admin, {
    last_reconcile_at: new Date().toISOString(),
    last_error: failed ? `${failed} deal falliti` : null,
  });

  return { synced, failed, total: targets.length };
}
