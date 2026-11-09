/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 *
 * Tipi minimi Mokapen per Fase 0. I tipi generati dall'OpenAPI
 * potranno sostituirli nelle fasi successive.
 */

export type MokapenTokenResponse = {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token?: string;
  organization_id?: number;
  organization_name?: string;
};

export type MokapenPipeline = {
  id?: number;
  pipeline_id?: number;
  title?: string;
  name?: string;
  [key: string]: unknown;
};

export type MokapenStatus = {
  id?: number;
  status_id?: number;
  title?: string;
  name?: string;
  sort?: number;
  [key: string]: unknown;
};

export type MokapenDeal = {
  deal_id?: number;
  id?: number;
  title?: string;
  pipeline_id?: number;
  status_id?: number;
  amount?: number | null;
  currency?: string | null;
  business_id?: number | null;
  [key: string]: unknown;
};

export type MokapenCompany = {
  company_id?: number;
  id?: number;
  title?: string;
  vat?: string | null;
  legal_owner_vat?: string | null;
  [key: string]: unknown;
};

export type MokapenListResponse<T> = {
  success?: boolean;
  message?: string;
  data?: T | { data?: T[]; [key: string]: unknown };
  [key: string]: unknown;
};
