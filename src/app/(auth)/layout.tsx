/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import { ImmentMark } from "@/components/brand/ImmentMark";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--ground)] text-[var(--text)]">
      <header className="flex items-center gap-2.5 px-6 py-5">
        <ImmentMark className="h-8 w-8" />
        <div>
          <p className="font-display text-[15px] font-semibold leading-tight">
            Partner Portal
          </p>
          <p className="text-[12px] text-[var(--muted)]">BAC × Imment</p>
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-6 sm:pt-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="border-t border-[var(--border)] px-4 py-3 text-center text-[12px] text-[var(--faint)]">
        Powered by Imment · Progettato e sviluppato da Giuseppe Pistoia · ©
        Imment S.r.l.
      </footer>
    </div>
  );
}
