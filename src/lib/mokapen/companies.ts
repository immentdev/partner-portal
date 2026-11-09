/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import type { MokapenClient } from "./client";
import type { MokapenCompany } from "./types";

function asCompanies(payload: unknown): MokapenCompany[] {
  if (Array.isArray(payload)) return payload as MokapenCompany[];
  if (payload && typeof payload === "object") {
    const root = payload as Record<string, unknown>;
    const data = root.data;
    if (Array.isArray(data)) return data as MokapenCompany[];
    if (data && typeof data === "object") {
      const inner = data as Record<string, unknown>;
      if (Array.isArray(inner.data)) return inner.data as MokapenCompany[];
      if (Array.isArray(inner.companies)) return inner.companies as MokapenCompany[];
    }
  }
  return [];
}

export function companyIdOf(company: MokapenCompany): number | null {
  const id = company.company_id ?? company.id;
  return typeof id === "number" ? id : id != null ? Number(id) : null;
}

/**
 * Cerca aziende per P.IVA.
 * Prova filtri su `vat` e `legal_owner_vat`, più search testuale.
 */
export async function findCompaniesByVat(
  client: MokapenClient,
  vat: string,
): Promise<{
  vatFilter: MokapenCompany[];
  legalOwnerVatFilter: MokapenCompany[];
  search: MokapenCompany[];
  working: Array<"filters[vat]" | "filters[legal_owner_vat]" | "search">;
}> {
  const working: Array<"filters[vat]" | "filters[legal_owner_vat]" | "search"> =
    [];

  let vatFilter: MokapenCompany[] = [];
  let legalOwnerVatFilter: MokapenCompany[] = [];
  let search: MokapenCompany[] = [];

  try {
    const res = await client.request<unknown>("GET", client.orgPath("/companies"), {
      filters: { vat },
      query: { per_page: 20 },
    });
    vatFilter = asCompanies(res);
    working.push("filters[vat]");
  } catch {
    // filtro non supportato / errore: si prova il successivo
  }

  try {
    const res = await client.request<unknown>("GET", client.orgPath("/companies"), {
      filters: { legal_owner_vat: vat },
      query: { per_page: 20 },
    });
    legalOwnerVatFilter = asCompanies(res);
    working.push("filters[legal_owner_vat]");
  } catch {
    // ignore
  }

  try {
    const res = await client.request<unknown>("GET", client.orgPath("/companies"), {
      query: { search: vat, per_page: 20 },
    });
    search = asCompanies(res);
    working.push("search");
  } catch {
    // ignore
  }

  return { vatFilter, legalOwnerVatFilter, search, working };
}

export async function storeCompany(
  client: MokapenClient,
  body: {
    title: string;
    vat?: string;
    legal_owner_vat?: string;
    description?: string;
  },
) {
  return client.request<unknown>("POST", client.orgPath("/store_company"), {
    body,
  });
}
