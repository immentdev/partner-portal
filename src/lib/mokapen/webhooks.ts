/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 *
 * Gestione webhook Mokapen (fuori dallo schema OpenAPI entity CRUD).
 */

import { MokapenError, type MokapenClient } from "./client";

export type MokapenWebhook = {
  id?: number | string;
  url?: string;
  events?: string[];
  org_id?: number;
  is_active?: boolean;
  [key: string]: unknown;
};

function asWebhookList(payload: unknown): MokapenWebhook[] {
  if (Array.isArray(payload)) return payload as MokapenWebhook[];
  if (payload && typeof payload === "object") {
    const root = payload as Record<string, unknown>;
    if (Array.isArray(root.data)) return root.data as MokapenWebhook[];
    if (Array.isArray(root.webhooks)) return root.webhooks as MokapenWebhook[];
  }
  return [];
}

export async function listWebhooks(client: MokapenClient) {
  return client.request<unknown>("GET", "/webhooks", { rawPath: true });
}

export async function registerWebhook(
  client: MokapenClient,
  body: { url: string; org_id: number | string; events: string[] },
) {
  return client.request<unknown>("POST", "/webhooks", {
    rawPath: true,
    body,
  });
}

/**
 * Registra un webhook, oppure riusa uno già presente sulla stessa URL.
 * Tollera un bug Mokapen (HTTP 500 su log) se il webhook risulta creato.
 */
export async function ensureWebhook(
  client: MokapenClient,
  body: { url: string; org_id: number | string; events: string[] },
): Promise<{ id: number | string; reused: boolean; raw: unknown }> {
  const existing = asWebhookList(await listWebhooks(client).catch(() => []));
  const match = existing.find((w) => w.url === body.url && w.id != null);
  if (match?.id != null) {
    return { id: match.id, reused: true, raw: match };
  }

  try {
    const raw = await registerWebhook(client, body);
    const id = extractWebhookId(raw);
    if (id == null) {
      throw new Error("Registrazione webhook ok ma id assente nel payload");
    }
    return { id, reused: false, raw };
  } catch (err) {
    // Mokapen a volte crea il webhook e poi fallisce sul logging (500).
    const recovered = recoverWebhookIdFromError(err) ??
      asWebhookList(await listWebhooks(client).catch(() => [])).find(
        (w) => w.url === body.url,
      )?.id;
    if (recovered != null) {
      return { id: recovered, reused: false, raw: { recovered_from_error: true } };
    }
    throw err;
  }
}

function extractWebhookId(payload: unknown): number | string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  for (const key of ["id", "webhook_id"]) {
    if (data[key] != null) return data[key] as number | string;
    if (root[key] != null) return root[key] as number | string;
  }
  return null;
}

function recoverWebhookIdFromError(err: unknown): number | string | null {
  if (!(err instanceof MokapenError)) return null;
  const text =
    typeof err.body === "string" ? err.body : JSON.stringify(err.body ?? "");
  if (!/Webhook registered/i.test(text)) return null;
  const match = text.match(/"id"\s*:\s*(\d+)/);
  return match?.[1] ? Number(match[1]) : null;
}

export async function listWebhookLogs(
  client: MokapenClient,
  webhookId: string | number,
) {
  return client.request<unknown>("GET", `/webhooks/${webhookId}/logs`, {
    rawPath: true,
  });
}

export async function deleteWebhook(
  client: MokapenClient,
  webhookId: string | number,
) {
  return client.request<unknown>("DELETE", `/webhooks/${webhookId}`, {
    rawPath: true,
  });
}
