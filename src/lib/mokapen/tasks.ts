/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import type { MokapenClient } from "./client";

export type StoreTaskInput = {
  title: string;
  owner_id: number | string;
  description?: string;
  notes?: string;
  status?: string;
  priority?: number;
  privacy?: number;
};

export async function storeTask(client: MokapenClient, body: StoreTaskInput) {
  return client.request<unknown>("POST", client.orgPath("/store_task"), {
    body,
  });
}

/** Collega un task (o altro) a un deal. */
export async function connectRecords(
  client: MokapenClient,
  entityType: string,
  entityId: number,
  connectedType: string,
  connectedId: number | number[],
) {
  return client.request<unknown>(
    "POST",
    client.orgPath(`/${entityType}/${entityId}/store_connection`),
    {
      body: {
        connected_type: connectedType,
        connected_id: connectedId,
      },
    },
  );
}
