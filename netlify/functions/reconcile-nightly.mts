/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 *
 * Schedule: ogni notte (vedi netlify.toml).
 */

import { createClient } from "@supabase/supabase-js";
import { reconcileOpenDeals } from "../../src/lib/domain/sync-deal";

export default async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return new Response("Missing Supabase env", { status: 500 });
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const result = await reconcileOpenDeals(admin);
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[reconcile-nightly]", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
};
