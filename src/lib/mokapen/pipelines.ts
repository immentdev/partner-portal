/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import type { MokapenClient } from "./client";
import type { MokapenPipeline, MokapenStatus } from "./types";

function asArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["data", "pipelines", "statuses", "status_list", "list"]) {
      const nested = obj[key];
      if (Array.isArray(nested)) return nested as T[];
      if (nested && typeof nested === "object") {
        const inner = nested as Record<string, unknown>;
        if (Array.isArray(inner.data)) return inner.data as T[];
      }
    }
  }
  return [];
}

export function pipelineIdOf(p: MokapenPipeline): number | null {
  const id = p.pipeline_id ?? p.id;
  return typeof id === "number" ? id : id != null ? Number(id) : null;
}

export function statusIdOf(s: MokapenStatus): number | null {
  const id = s.status_id ?? s.id;
  return typeof id === "number" ? id : id != null ? Number(id) : null;
}

export function statusTitleOf(s: MokapenStatus): string {
  return String(s.title ?? s.name ?? statusIdOf(s) ?? "");
}

/**
 * Mokapen usa l'entity_type singolare `deal` (non `deals`)
 * per pipeline_list / status_list / info_pipeline.
 */
const DEAL_ENTITY = "deal";

/** GET /v1/{org}/deal/pipeline_list */
export async function listDealPipelines(client: MokapenClient) {
  const res = await client.request<unknown>(
    "GET",
    `/v1/${client.orgId}/${DEAL_ENTITY}/pipeline_list`,
  );
  return asArray<MokapenPipeline>(res);
}

/** GET /v1/{org}/deal/status_list/{pipeline_id} */
export async function listPipelineStatuses(
  client: MokapenClient,
  pipelineId: number,
) {
  const res = await client.request<unknown>(
    "GET",
    `/v1/${client.orgId}/${DEAL_ENTITY}/status_list/${pipelineId}`,
  );
  return asArray<MokapenStatus>(res);
}

/** GET /v1/{org}/deal/info_pipeline/{pipeline_id} */
export async function getPipelineInfo(
  client: MokapenClient,
  pipelineId: number,
) {
  return client.request<unknown>(
    "GET",
    `/v1/${client.orgId}/${DEAL_ENTITY}/info_pipeline/${pipelineId}`,
  );
}
