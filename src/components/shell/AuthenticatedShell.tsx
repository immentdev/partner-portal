/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/roles";
import { AppShell } from "./AppShell";

export async function AuthenticatedShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .schema("partner")
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <AppShell
      role={(profile?.role as AppRole | null) ?? null}
      email={user?.email}
      fullName={profile?.full_name}
    >
      {children}
    </AppShell>
  );
}
