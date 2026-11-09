/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 *
 * Client HTTP Mokapen: client_credentials, Bearer, retry su 429.
 */

import type { MokapenTokenResponse } from "./types";

const API_BASE = "https://mokapen.com/api";
const TOKEN_URL = "https://mokapen.com/oauth/token";

export const MOKAPEN_SCOPES = [
  "deals.read",
  "deals.write",
  "contacts.write",
  "companies.read",
  "companies.write",
  "tasks.write",
].join(" ");

export class MokapenError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "MokapenError";
  }
}

export type MokapenClientOptions = {
  orgId: string | number;
  clientId: string;
  clientSecret: string;
  /** Token già emesso; se assente viene richiesto via client_credentials. */
  accessToken?: string;
  scope?: string;
  maxRetries?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MokapenClient {
  readonly orgId: string;
  private accessToken: string | null;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly scope: string;
  private readonly maxRetries: number;

  constructor(opts: MokapenClientOptions) {
    this.orgId = String(opts.orgId);
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
    this.accessToken = opts.accessToken?.trim() || null;
    this.scope = opts.scope ?? MOKAPEN_SCOPES;
    this.maxRetries = opts.maxRetries ?? 4;
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): MokapenClient {
    const orgId = env.MOKAPEN_ORG_ID;
    const clientId = env.MOKAPEN_CLIENT_ID;
    const clientSecret = env.MOKAPEN_CLIENT_SECRET;
    if (!orgId || !clientId || !clientSecret) {
      throw new Error(
        "Servono MOKAPEN_ORG_ID, MOKAPEN_CLIENT_ID e MOKAPEN_CLIENT_SECRET",
      );
    }
    return new MokapenClient({
      orgId,
      clientId,
      clientSecret,
      accessToken: env.MOKAPEN_ACCESS_TOKEN,
    });
  }

  /** Ottiene (o rinnova) un access token con client_credentials. */
  async obtainToken(): Promise<MokapenTokenResponse> {
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: this.scope,
      organization_id: this.orgId,
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const json = (await res.json().catch(() => null)) as
      | MokapenTokenResponse
      | { error?: string; message?: string }
      | null;

    if (!res.ok || !json || !("access_token" in json) || !json.access_token) {
      throw new MokapenError(
        `Token Mokapen fallito (${res.status})`,
        res.status,
        json,
      );
    }

    this.accessToken = json.access_token;
    return json;
  }

  async ensureToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;
    const token = await this.obtainToken();
    return token.access_token;
  }

  /** Path relativo a /api, es. `/v1/{org}/deals`. */
  async request<T = unknown>(
    method: string,
    path: string,
    options: {
      query?: Record<string, string | number | boolean | undefined | null>;
      /** Filtri stile Mokapen: filters[field][]=value */
      filters?: Record<string, string | string[]>;
      body?: unknown;
      rawPath?: boolean;
    } = {},
  ): Promise<T> {
    const token = await this.ensureToken();
    const url = new URL(
      options.rawPath ? `${API_BASE}${path}` : `${API_BASE}${path}`,
    );

    if (options.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value === undefined || value === null) continue;
        url.searchParams.set(key, String(value));
      }
    }

    if (options.filters) {
      for (const [field, raw] of Object.entries(options.filters)) {
        const values = Array.isArray(raw) ? raw : [raw];
        for (const value of values) {
          url.searchParams.append(`filters[${field}][]`, value);
        }
      }
    }

    let attempt = 0;
    while (true) {
      const res = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
        },
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });

      if (res.status === 429 && attempt < this.maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after"));
        const waitMs = Number.isFinite(retryAfter)
          ? retryAfter * 1000
          : 500 * 2 ** attempt;
        await sleep(waitMs);
        attempt += 1;
        continue;
      }

      const text = await res.text();
      let json: unknown = null;
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = text;
        }
      }

      if (!res.ok) {
        throw new MokapenError(
          `Mokapen ${method} ${path} → ${res.status}`,
          res.status,
          json,
        );
      }

      return json as T;
    }
  }

  orgPath(suffix: string): string {
    const clean = suffix.startsWith("/") ? suffix : `/${suffix}`;
    return `/v1/${this.orgId}${clean}`;
  }
}
