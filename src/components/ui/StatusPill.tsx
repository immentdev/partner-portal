/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import {
  macrostateLabel,
  macrostateTone,
  type MacrostateTone,
} from "@/lib/ui/labels";

const TONE_CLASS: Record<MacrostateTone, string> = {
  neutral: "bg-[var(--pill-neutral-bg)] text-[var(--pill-neutral-ink)]",
  positive: "bg-[var(--pill-positive-bg)] text-[var(--pill-positive-ink)]",
  warning: "bg-[var(--pill-warning-bg)] text-[var(--pill-warning-ink)]",
  negative: "bg-[var(--pill-negative-bg)] text-[var(--pill-negative-ink)]",
  accent: "bg-[var(--pill-accent-bg)] text-[var(--pill-accent-ink)]",
};

export function StatusPill({
  value,
  label,
}: {
  value?: string | null;
  label?: string;
}) {
  const tone = macrostateTone(value);
  return (
    <span
      className={`inline-flex h-5 max-w-full items-center whitespace-nowrap rounded px-2 text-[12px] font-medium ${TONE_CLASS[tone]}`}
    >
      {label ?? macrostateLabel(value)}
    </span>
  );
}
