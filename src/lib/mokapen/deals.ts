/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import type { MokapenClient } from "./client";
import type { MokapenDeal } from "./types";

export type StoreDealInput = {
  title: string;
  pipeline_id: number;
  status_id?: number;
  amount?: number | null;
  currency?: string | null;
  description?: string;
  notes?: string;
  business_id?: number;
  owner_id?: string | number;
  test_deal?: boolean;
  source?: string;
  source_code?: string;
  type?: string;
  type2?: string;
};

function unwrapDeal(payload: unknown): MokapenDeal {
  if (!payload || typeof payload !== "object") return {};
  const root = payload as Record<string, unknown>;
  const data = (root.data ?? root) as Record<string, unknown>;
  const info = (data.info_deal ?? data.deal ?? data) as MokapenDeal;
  return info;
}

export function dealIdOf(deal: MokapenDeal): number | null {
  const id = deal.deal_id ?? deal.id;
  return typeof id === "number" ? id : id != null ? Number(id) : null;
}

export async function listDeals(
  client: MokapenClient,
  opts: {
    page?: number;
    perPage?: number;
    search?: string;
    filters?: Record<string, string | string[]>;
  } = {},
) {
  return client.request<unknown>("GET", client.orgPath("/deals"), {
    query: {
      page: opts.page,
      per_page: opts.perPage,
      search: opts.search,
    },
    filters: opts.filters,
  });
}

export async function readDeal(client: MokapenClient, dealId: number) {
  const res = await client.request<unknown>(
    "GET",
    client.orgPath(`/read_deal/${dealId}`),
  );
  return unwrapDeal(res);
}

export async function storeDeal(client: MokapenClient, body: StoreDealInput) {
  const res = await client.request<unknown>(
    "POST",
    client.orgPath("/store_deal"),
    { body },
  );
  return unwrapDeal(res);
}

export async function updateDeal(
  client: MokapenClient,
  dealId: number,
  body: Partial<StoreDealInput> & { archived?: boolean },
) {
  const res = await client.request<unknown>(
    "PUT",
    client.orgPath(`/update_deal/${dealId}`),
    { body },
  );
  return unwrapDeal(res);
}

/** Chiavi potenzialmente legate alla fee partner / success fee. */
export function findFeeLikeKeys(deal: MokapenDeal): Record<string, unknown> {
  const hit: Record<string, unknown> = {};
  const walk = (obj: unknown, prefix = "") => {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => walk(item, `${prefix}[${i}]`));
      return;
    }
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (/fee|success.?fee|importo.?success|partner.?fee|commission/i.test(key)) {
        hit[path] = value;
      }
      if (value && typeof value === "object") walk(value, path);
    }
  };
  walk(deal);
  return hit;
}
