/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { partnerDb } from "@/lib/supabase/partner";

export type AnomalyType =
  | "sla_validation"
  | "possible_duplicate"
  | "unlinked_deal"
  | "deal_out_of_window"
  | "fee_decreased"
  | "fee_unpaid"
  | "sync_stalled"
  | "stage_regression"
  | "dispute";

export async function openAnomaly(
  admin: SupabaseClient,
  input: {
    type: AnomalyType;
    title: string;
    detail?: string;
    referral_id?: string;
    referral_deal_id?: string;
    due_at?: string;
  },
) {
  const { data, error } = await partnerDb(admin)
    .from("anomalies")
    .insert({
      type: input.type,
      title: input.title,
      detail: input.detail ?? null,
      referral_id: input.referral_id ?? null,
      referral_deal_id: input.referral_deal_id ?? null,
      due_at: input.due_at ?? null,
      status: "open",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}
