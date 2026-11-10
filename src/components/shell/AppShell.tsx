/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import { ImmentMark } from "@/components/brand/ImmentMark";
import { LogoutButton } from "@/components/shell/LogoutButton";
import { MobileNav, type NavItem } from "@/components/shell/MobileNav";
import { SideNav } from "@/components/shell/SideNav";
import type { AppRole } from "@/lib/auth/roles";
import { isImmentStaff } from "@/lib/auth/roles";
import { roleLabel } from "@/lib/ui/labels";

function navItemsForRole(role: AppRole | null | undefined): NavItem[] {
  const items: NavItem[] = [{ href: "/referrals", label: "Segnalazioni" }];
  if (role === "bac_nazionale" || (role && isImmentStaff(role))) {
    items.push(
      { href: "/territories", label: "Territori" },
      { href: "/statements", label: "Rendiconti" },
    );
  }
  if (role && isImmentStaff(role)) {
    items.unshift({ href: "/admin", label: "Admin" });
  }
  return items;
}

export function AppShell({
  children,
  role,
  email,
  fullName,
}: {
  children: React.ReactNode;
  role: AppRole | null;
  email?: string | null;
  fullName?: string | null;
}) {
  const items = navItemsForRole(role);
  const scope = roleLabel(role);

  return (
    <div className="app-frame min-h-screen bg-[var(--ground)] text-[var(--text)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-[232px] shrink-0 flex-col px-3 py-4 lg:flex">
          <div className="mb-6 flex items-start gap-2.5 px-2 pt-1">
            <ImmentMark className="mt-0.5 h-8 w-8 shrink-0" />
            <div className="min-w-0">
              <p className="font-display text-[15px] font-semibold leading-tight text-[var(--text)]">
                Partner Portal
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-[var(--muted)]">
                BAC × Imment
              </p>
            </div>
          </div>

          <p className="mb-2 px-2 text-[12px] text-[var(--faint)]">Area di lavoro</p>
          <SideNav items={items} />

          <div className="mt-auto space-y-3 border-t border-[var(--border)] px-2 pb-2 pt-4">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-[var(--text)]">
                {fullName || email || "Account"}
              </p>
              <p className="truncate text-[12px] text-[var(--muted)]">{scope}</p>
            </div>
            <LogoutButton className="w-full" />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col lg:pr-2 lg:pb-2">
          <header className="flex h-12 items-center justify-between gap-3 px-4 lg:px-2 lg:pr-6">
            <div className="flex min-w-0 items-center gap-3 lg:hidden">
              <MobileNav items={items} scope={scope} email={email} />
              <div className="min-w-0">
                <p className="truncate font-display text-[15px] font-semibold">
                  Partner Portal
                </p>
                <p className="truncate text-[12px] text-[var(--muted)]">{scope}</p>
              </div>
            </div>
            <div className="hidden min-w-0 lg:block">
              <p className="text-[13px] text-[var(--muted)]">
                Segnalazioni commerciali · stati Mokapen · fee partner
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-[12px] text-[var(--faint)] sm:inline">
                {scope}
              </span>
              <LogoutButton className="lg:hidden" />
            </div>
          </header>

          <div className="app-sheet flex min-h-0 flex-1 flex-col overflow-hidden border border-[var(--border)] bg-[var(--surface)] lg:rounded-2xl">
            <div className="flex-1 overflow-auto p-4 sm:p-6">{children}</div>
            <footer className="border-t border-[var(--rule)] px-4 py-3 text-center text-[12px] text-[var(--faint)] sm:px-6">
              Powered by Imment · Progettato e sviluppato da Giuseppe Pistoia · ©
              Imment S.r.l.
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
