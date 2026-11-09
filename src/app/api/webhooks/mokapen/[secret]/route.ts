/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 *
 * Webhook Mokapen: il payload non è attendibile — si usa solo l'id deal, poi GET.
 */

import { NextResponse } from "next/server";
import { writeAudit } from "@/lib/audit";
import { syncDealByMokapenId } from "@/lib/domain/sync-deal";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function extractDealId(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const candidates = [
    root.deal_id,
    root.id,
    data.deal_id,
    data.id,
    (data.deal as Record<string, unknown> | undefined)?.deal_id,
    (data.deal as Record<string, unknown> | undefined)?.id,
    (data.info_deal as Record<string, unknown> | undefined)?.deal_id,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function extractEvent(payload: unknown): "deal.created" | "deal.updated" {
  if (payload && typeof payload === "object") {
    const ev = String(
      (payload as { event?: string; type?: string }).event ??
        (payload as { type?: string }).type ??
        "",
    );
    if (ev.includes("created")) return "deal.created";
  }
  return "deal.updated";
}

export async function POST(
  request: Request,
  context: { params: { secret: string } },
) {
  const expected = process.env.MOKAPEN_WEBHOOK_SECRET?.trim();
  if (!expected || context.params.secret !== expected) {
    // Brief: 404 + log, senza rivelare l'esistenza dell'endpoint
    try {
      const admin = createAdminClient();
      await writeAudit(admin, {
        action: "webhook.rejected",
        entity_type: "mokapen_webhook",
        meta: { reason: "invalid_secret" },
      });
    } catch {
      // ignore
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dealId = extractDealId(payload);
  if (!dealId) {
    return NextResponse.json({ error: "deal id missing" }, { status: 400 });
  }

  const event = extractEvent(payload);
  const admin = createAdminClient();

  try {
    const result = await syncDealByMokapenId(admin, dealId, { event });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[webhook mokapen]", err);
    await writeAudit(admin, {
      action: "webhook.error",
      entity_type: "mokapen_webhook",
      entity_id: String(dealId),
      meta: { error: err instanceof Error ? err.message : String(err) },
    }).catch(() => undefined);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "sync failed" },
      { status: 500 },
    );
  }
}
