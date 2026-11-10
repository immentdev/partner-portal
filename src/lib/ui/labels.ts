/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

export const MACROSTATE_LABELS: Record<string, string> = {
  in_valutazione: "In valutazione",
  non_accettato: "Non accettato",
  proposta_inviata: "Proposta inviata",
  incarico_attivo: "Incarico attivo",
  chiuso_non_acquisito: "Chiuso non acquisito",
};

export function macrostateLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return MACROSTATE_LABELS[value] ?? value.replaceAll("_", " ");
}

export type MacrostateTone = "neutral" | "positive" | "warning" | "negative" | "accent";

export function macrostateTone(value: string | null | undefined): MacrostateTone {
  switch (value) {
    case "incarico_attivo":
      return "positive";
    case "proposta_inviata":
      return "accent";
    case "in_valutazione":
      return "warning";
    case "non_accettato":
    case "chiuso_non_acquisito":
      return "negative";
    default:
      return "neutral";
  }
}

export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case "super_admin":
      return "Super admin";
    case "imment_admin":
      return "Admin Imment";
    case "bac_nazionale":
      return "BAC Nazionale";
    case "bac_locale":
      return "BAC Locale";
    default:
      return "Partner";
  }
}

export function formatMoney(value: number | null | undefined): string {
  if (value == null) return "—";
  return `€ ${Number(value).toLocaleString("it-IT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

export function formatFee(
  value: number | null | undefined,
  kind: "prevista" | "maturata",
): string {
  if (value == null || Number(value) === 0) {
    return kind === "maturata" ? "nessuna fee maturata" : "—";
  }
  return formatMoney(value);
}
