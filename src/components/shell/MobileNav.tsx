/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";

export type NavItem = { href: string; label: string };

export function MobileNav({
  items,
  scope,
  email,
}: {
  items: NavItem[];
  scope: string;
  email?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav-sheet"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--control)] bg-[var(--surface)] text-[var(--text)]"
      >
        <span className="sr-only">{open ? "Chiudi menu" : "Apri menu"}</span>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          {open ? (
            <path
              d="M4 4l10 10M14 4L4 14"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="M3 5h12M3 9h12M3 13h12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>

      {open ? (
        <div
          id="mobile-nav-sheet"
          className="fixed inset-0 z-40 bg-[var(--ground)] p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Navigazione"
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="font-display text-lg font-semibold text-[var(--text)]">
                Partner Portal
              </p>
              <p className="text-[13px] text-[var(--muted)]">{scope}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] border border-[var(--control)] bg-[var(--surface)]"
            >
              <span className="sr-only">Chiudi</span>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path
                  d="M4 4l10 10M14 4L4 14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <nav className="space-y-1">
            {items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-lg px-3 py-3 text-[15px] ${
                    active
                      ? "bg-[var(--active)] font-medium text-[var(--text)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 space-y-3 border-t border-[var(--border)] pt-6">
            {email ? (
              <p className="truncate text-[13px] text-[var(--muted)]">{email}</p>
            ) : null}
            <LogoutButton className="w-full" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
