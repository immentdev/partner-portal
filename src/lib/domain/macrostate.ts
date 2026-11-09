/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 *
 * Mappatura fasi pipeline Partner (Mokapen id 585) → macrostati portale.
 * Indici = status_id Mokapen (non i nomi). Scoperti nello smoke test Fase 0.
 */

export type Macrostate =
  | "in_valutazione"
  | "non_accettato"
  | "proposta_inviata"
  | "incarico_attivo"
  | "chiuso_non_acquisito";

/** Chiave campo fee sul deal Mokapen (ex «Importo success fee»). */
export const MOKAPEN_FEE_FIELD = "importo_success_fee" as const;

/** Campo booleano/affiancato eventualmente presente sul deal. */
export const MOKAPEN_SUCCESS_FEE_FLAG = "success_fee" as const;

export const PARTNER_PIPELINE_ID = 585;

/**
 * status_id → macrostate + effetto lato portale.
 * Fonte: GET /v1/{org}/deal/status_list/585 (org Imment 1077).
 */
export const STAGE_BY_ID = {
  18713: {
    title: "Nuovo lead",
    macrostate: "in_valutazione" as const,
    effects: [] as const,
  },
  18715: {
    title: "Accettato",
    macrostate: "in_valutazione" as const,
    effects: ["accept"] as const,
  },
  18716: {
    title: "Rifiutato",
    macrostate: "non_accettato" as const,
    effects: ["reject"] as const,
  },
  18714: {
    title: "Opportunità esistente",
    macrostate: "non_accettato" as const,
    effects: ["existing"] as const,
  },
  18719: {
    title: "Contratto mandato",
    macrostate: "proposta_inviata" as const,
    effects: [] as const,
  },
  18720: {
    title: "Chiuso vinto",
    macrostate: "incarico_attivo" as const,
    effects: ["signed"] as const,
  },
  18721: {
    title: "Chiuso perso",
    macrostate: "chiuso_non_acquisito" as const,
    effects: [] as const,
  },
  18827: {
    title: "Fatturato",
    macrostate: "incarico_attivo" as const,
    effects: [] as const,
  },
  18828: {
    title: "Incassato",
    macrostate: "incarico_attivo" as const,
    effects: ["cashed"] as const,
  },
} as const satisfies Record<
  number,
  {
    title: string;
    macrostate: Macrostate;
    effects: readonly string[];
  }
>;

export type PartnerStageId = keyof typeof STAGE_BY_ID;

export function macrostateForStageId(
  stageId: number | null | undefined,
): Macrostate | null {
  if (stageId == null) return null;
  const stage = STAGE_BY_ID[stageId as PartnerStageId];
  return stage?.macrostate ?? null;
}

export function isPartnerStageId(id: number): id is PartnerStageId {
  return id in STAGE_BY_ID;
}
