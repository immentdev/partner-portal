/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { partnerDb } from "@/lib/supabase/partner";

export async function writeAudit(
  admin: SupabaseClient,
  input: {
    actor_id?: string | null;
    action: string;
    entity_type: string;
    entity_id?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  const { error } = await partnerDb(admin).from("audit_log").insert({
    actor_id: input.actor_id ?? null,
    action: input.action,
    entity_type: input.entity_type,
    entity_id: input.entity_id ?? null,
    meta: input.meta ?? {},
  });
  if (error) throw error;
}
