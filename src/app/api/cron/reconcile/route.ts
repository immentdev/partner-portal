/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import { NextResponse } from "next/server";
import { reconcileOpenDeals } from "@/lib/domain/sync-deal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!secret || header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await reconcileOpenDeals(createAdminClient());
  return NextResponse.json(result);
}
