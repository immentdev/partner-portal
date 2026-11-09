/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createReferral } from "@/lib/domain/create-referral";
import type { Profile } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { partnerDb } from "@/lib/supabase/partner";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await partnerDb(supabase)
      .from("profiles")
      .select(
        "id, email, full_name, role, partner_org_id, territory_id, mokapen_contact_id, is_emergency",
      )
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Profilo non trovato" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const admin = createAdminClient();
    const result = await createReferral({
      admin,
      profile: profile as Profile,
      body,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validazione fallita", issues: err.flatten() },
        { status: 400 },
      );
    }
    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status: number }).status)
        : 500;
    const message = err instanceof Error ? err.message : "Errore interno";
    console.error("[POST /api/referrals]", err);
    return NextResponse.json({ error: message }, { status: status || 500 });
  }
}
