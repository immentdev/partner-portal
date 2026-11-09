/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 *
 * Tutte le tabelle vivono nello schema `partner` (coesistenza con FundOps su Imment).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const PARTNER_SCHEMA = "partner";

export function partnerDb(client: SupabaseClient) {
  return client.schema(PARTNER_SCHEMA);
}
