/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import type { MokapenClient } from "./client";

export type StoreContactInput = {
  name: string;
  surname: string;
  email1: string;
  phone1?: string;
  description?: string;
};

function unwrapId(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const info =
    (data.info_contact as Record<string, unknown> | undefined) ??
    (data.contact as Record<string, unknown> | undefined) ??
    data;
  const id = info.contact_id ?? info.id;
  return id != null ? Number(id) : null;
}

export async function storeContact(
  client: MokapenClient,
  body: StoreContactInput,
) {
  const res = await client.request<unknown>(
    "POST",
    client.orgPath("/store_contact"),
    { body },
  );
  return { raw: res, id: unwrapId(res) };
}

export function splitFullName(fullName: string): { name: string; surname: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { name: parts[0]!, surname: "-" };
  return {
    name: parts[0]!,
    surname: parts.slice(1).join(" "),
  };
}
