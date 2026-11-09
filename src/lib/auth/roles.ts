/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

export type AppRole =
  | "super_admin"
  | "imment_admin"
  | "bac_nazionale"
  | "bac_locale";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: AppRole;
  partner_org_id: string | null;
  territory_id: string | null;
  mokapen_contact_id: number | null;
  is_emergency: boolean;
};

export function requiresAal2(role: AppRole): boolean {
  return (
    role === "super_admin" ||
    role === "imment_admin" ||
    role === "bac_nazionale"
  );
}

export function isImmentStaff(role: AppRole): boolean {
  return role === "super_admin" || role === "imment_admin";
}

export function homePathForRole(role: AppRole): string {
  if (isImmentStaff(role)) return "/admin";
  return "/referrals";
}
