/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 *
 * SLA: referral ancora in «Nuovo lead» dopo 5 giorni lavorativi.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { openAnomaly } from "@/lib/domain/anomalies";
import { sendEmail } from "@/lib/email/resend";
import { partnerDb } from "@/lib/supabase/partner";

const NUOVO_LEAD = 18713;

function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  return d;
}

export async function checkValidationSla(admin: SupabaseClient) {
  const db = partnerDb(admin);
  const { data: deals, error } = await db
    .from("referral_deals")
    .select("id, referral_id, mokapen_status_id, created_at, is_primary")
    .eq("is_primary", true)
    .eq("mokapen_status_id", NUOVO_LEAD);

  if (error) throw error;

  const now = new Date();
  let opened = 0;

  for (const deal of deals ?? []) {
    const created = new Date(deal.created_at as string);
    const due = addBusinessDays(created, 5);
    if (now < due) continue;

    const { data: referral } = await db
      .from("referrals")
      .select("id, code, company_name, partner_org_id")
      .eq("id", deal.referral_id)
      .maybeSingle();
    if (!referral) continue;

    // Evita duplicati aperti
    const { data: existing } = await db
      .from("anomalies")
      .select("id")
      .eq("type", "sla_validation")
      .eq("referral_id", referral.id)
      .eq("status", "open")
      .limit(1);
    if (existing?.length) continue;

    await openAnomaly(admin, {
      type: "sla_validation",
      title: `SLA validazione — ${referral.code}`,
      detail: `Ancora in Nuovo lead da oltre 5 giorni lavorativi (${referral.company_name}).`,
      referral_id: referral.id,
      referral_deal_id: deal.id,
      due_at: due.toISOString(),
    });
    opened += 1;

    const pp = process.env.SLA_PP_EMAIL?.trim();
    const nazionale = process.env.SLA_NAZIONALE_EMAIL?.trim();
    const recipients = [pp, nazionale].filter(Boolean) as string[];
    if (recipients.length) {
      await sendEmail({
        to: recipients,
        subject: `SLA validazione: ${referral.code}`,
        html: `<p>Il referral <strong>${referral.code}</strong> (${referral.company_name})
          è ancora in Nuovo lead oltre lo SLA di 5 giorni lavorativi.</p>`,
      }).catch((e) => console.error("[sla email]", e));
    }
  }

  return { opened, scanned: deals?.length ?? 0 };
}
