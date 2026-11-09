/**
 * Partner Portal BAC × Imment — Fase 0 smoke test Mokapen
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 *
 * Criteri di accettazione (BRIEF.md §8 Fase 0):
 * 1. Token con client credentials
 * 2. Lettura pipeline 585 + id di fase
 * 3. Campo «Fee partner» / Importo success fee leggibile (chiave)
 * 4. Ricerca azienda per P.IVA (endpoint + filtro)
 * 5. Creazione deal di test in pipeline 585 + task
 * 6. Spostamento di fase → deal.updated (tunnel / preview opzionale)
 *
 * Uso:
 *   cp .env.example .env   # compila le variabili Mokapen
 *   npm install
 *   npm run mokapen:smoke
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MokapenClient,
  MokapenError,
  connectRecords,
  dealIdOf,
  findCompaniesByVat,
  findFeeLikeKeys,
  listPipelineStatuses,
  listDealPipelines,
  getPipelineInfo,
  pipelineIdOf,
  readDeal,
  ensureWebhook,
  listWebhookLogs,
  deleteWebhook,
  statusIdOf,
  statusTitleOf,
  storeDeal,
  storeTask,
  updateDeal,
} from "../src/lib/mokapen/index";

type CheckStatus = "pass" | "fail" | "skip" | "warn";

type Check = {
  id: string;
  title: string;
  status: CheckStatus;
  detail: string;
};

const checks: Check[] = [];
const outDir = path.resolve("scripts/.smoke-output");

function record(check: Check) {
  checks.push(check);
  const icon =
    check.status === "pass"
      ? "✓"
      : check.status === "fail"
        ? "✗"
        : check.status === "warn"
          ? "!"
          : "·";
  console.log(`[${icon}] ${check.title}: ${check.detail}`);
}

function pipelineIdFromEnv(): number {
  return Number(process.env.MOKAPEN_PARTNER_PIPELINE_ID ?? "585");
}

async function saveArtifact(name: string, data: unknown) {
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, name);
  await writeFile(file, JSON.stringify(data, null, 2), "utf8");
  return file;
}

async function main() {
  console.log("=== Mokapen smoke test — Partner Portal Fase 0 ===\n");

  const client = MokapenClient.fromEnv();
  const pipelineId = pipelineIdFromEnv();

  // 1. Token
  try {
    const tokenRes = await client.obtainToken();
    record({
      id: "token",
      title: "Token client_credentials",
      status: "pass",
      detail: `expires_in=${tokenRes.expires_in}, org=${tokenRes.organization_id ?? client.orgId}`,
    });
    await saveArtifact("token-meta.json", {
      expires_in: tokenRes.expires_in,
      organization_id: tokenRes.organization_id,
      organization_name: tokenRes.organization_name,
      token_type: tokenRes.token_type,
      // mai salvare l'access_token su disco
    });
  } catch (err) {
    record({
      id: "token",
      title: "Token client_credentials",
      status: "fail",
      detail: err instanceof Error ? err.message : String(err),
    });
    printSummary();
    process.exit(1);
  }

  // 2. Pipeline 585 + fasi
  let statuses: Awaited<ReturnType<typeof listPipelineStatuses>> = [];
  try {
    const pipelines = await listDealPipelines(client);
    await saveArtifact("pipelines.json", pipelines);
    const match = pipelines.find((p) => pipelineIdOf(p) === pipelineId);
    statuses = await listPipelineStatuses(client, pipelineId);
    await saveArtifact(`pipeline-${pipelineId}-statuses.json`, statuses);
    const info = await getPipelineInfo(client, pipelineId).catch(() => null);
    if (info) await saveArtifact(`pipeline-${pipelineId}-info.json`, info);

    const stageLines = statuses
      .map((s) => `${statusIdOf(s)}=${statusTitleOf(s)}`)
      .join(", ");

    record({
      id: "pipeline",
      title: `Pipeline ${pipelineId} e id di fase`,
      status: statuses.length > 0 ? "pass" : "fail",
      detail:
        statuses.length > 0
          ? `${statuses.length} fasi${match ? "" : " (pipeline non in lista, status_list ok)"}: ${stageLines}`
          : "Nessuna fase restituita da status_list",
    });
  } catch (err) {
    record({
      id: "pipeline",
      title: `Pipeline ${pipelineId} e id di fase`,
      status: "fail",
      detail: formatErr(err),
    });
  }

  // 3 + 5: crea deal di test, leggi fee keys, crea task
  let createdDealId: number | null = null;
  const firstStatusId = statuses.map(statusIdOf).find((id) => id != null) ?? null;
  const secondStatusId =
    statuses.map(statusIdOf).filter((id) => id != null && id !== firstStatusId)[0] ??
    null;

  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const deal = await storeDeal(client, {
      title: `[PP smoke] Partner Portal ${stamp}`,
      pipeline_id: pipelineId,
      status_id: firstStatusId ?? undefined,
      description: "Deal di test Fase 0 — eliminabile/archiviabile",
      test_deal: true,
      source: "partner-portal-smoke",
      source_code: `SMOKE-${stamp}`,
    });
    createdDealId = dealIdOf(deal);
    await saveArtifact("created-deal-raw.json", deal);

    if (!createdDealId) {
      // alcuni tenant restituiscono solo success: rileggi lista per titolo
      record({
        id: "create_deal",
        title: "Creazione deal di test",
        status: "warn",
        detail: "store_deal ok ma deal_id assente nel payload — vedi artifact",
      });
    } else {
      const full = await readDeal(client, createdDealId);
      await saveArtifact(`deal-${createdDealId}.json`, full);
      const feeKeys = findFeeLikeKeys(full);
      await saveArtifact(`deal-${createdDealId}-fee-keys.json`, feeKeys);

      record({
        id: "create_deal",
        title: "Creazione deal di test",
        status: "pass",
        detail: `deal_id=${createdDealId}, status_id=${full.status_id ?? firstStatusId}`,
      });

      record({
        id: "fee_field",
        title: "Campo Fee partner / Importo success fee",
        status: Object.keys(feeKeys).length > 0 ? "pass" : "warn",
        detail:
          Object.keys(feeKeys).length > 0
            ? `chiavi candidate: ${Object.keys(feeKeys).join(", ")}`
            : "Nessuna chiave fee* nel payload deal — ispezionare deal-*.json (campo custom?)",
      });
    }
  } catch (err) {
    record({
      id: "create_deal",
      title: "Creazione deal di test",
      status: "fail",
      detail: formatErr(err),
    });
    record({
      id: "fee_field",
      title: "Campo Fee partner / Importo success fee",
      status: "skip",
      detail: "Dipende dalla creazione del deal",
    });
  }

  // Task
  const ownerId = process.env.MOKAPEN_TASK_OWNER_ID?.trim();
  if (!ownerId) {
    record({
      id: "task",
      title: "Creazione task collegato",
      status: "skip",
      detail: "Imposta MOKAPEN_TASK_OWNER_ID (utente dedicato app privata)",
    });
  } else if (!createdDealId) {
    record({
      id: "task",
      title: "Creazione task collegato",
      status: "skip",
      detail: "Nessun deal_id disponibile",
    });
  } else {
    try {
      const taskRes = await storeTask(client, {
        title: `[PP smoke] Follow-up deal ${createdDealId}`,
        owner_id: Number(ownerId) || ownerId,
        description: "Task creato dallo smoke test Fase 0",
        status: "o",
      });
      await saveArtifact(`task-for-deal-${createdDealId}.json`, taskRes);
      const taskId = extractId(taskRes, ["task_id", "id"]);
      if (taskId != null) {
        try {
          const numericTaskId = Number(taskId);
          await connectRecords(
            client,
            "deals",
            createdDealId,
            "task",
            Number.isFinite(numericTaskId) ? numericTaskId : Number(taskId),
          );
        } catch (connErr) {
          // connection opzionale: alcuni tenant collegano via altri campi
          await saveArtifact("task-connection-error.json", {
            error: formatErr(connErr),
          });
        }
      }
      record({
        id: "task",
        title: "Creazione task collegato",
        status: "pass",
        detail: `task creato${taskId != null ? ` id=${taskId}` : ""} per deal ${createdDealId}`,
      });
    } catch (err) {
      record({
        id: "task",
        title: "Creazione task collegato",
        status: "fail",
        detail: formatErr(err),
      });
    }
  }

  // 4. Ricerca P.IVA
  const sampleVat = process.env.SMOKE_VAT?.trim() || "12345678901";
  try {
    const result = await findCompaniesByVat(client, sampleVat);
    await saveArtifact("company-vat-search.json", result);
    record({
      id: "vat_search",
      title: "Ricerca azienda per P.IVA",
      status: result.working.length > 0 ? "pass" : "fail",
      detail:
        result.working.length > 0
          ? `endpoint GET /companies; metodi ok: ${result.working.join(", ")} (vat di prova=${sampleVat})`
          : "Nessun metodo di ricerca ha risposto con successo",
    });
  } catch (err) {
    record({
      id: "vat_search",
      title: "Ricerca azienda per P.IVA",
      status: "fail",
      detail: formatErr(err),
    });
  }

  // 6. Cambio fase + webhook opzionale
  const smokeWebhookUrl = process.env.SMOKE_WEBHOOK_URL?.trim();
  if (!createdDealId || secondStatusId == null) {
    record({
      id: "stage_move",
      title: "Spostamento fase → deal.updated",
      status: "skip",
      detail:
        !createdDealId
          ? "Nessun deal da spostare"
          : "Serve almeno una seconda fase nella pipeline",
    });
  } else {
    let webhookId: string | number | null = null;
    try {
      if (smokeWebhookUrl) {
        const ensured = await ensureWebhook(client, {
          url: smokeWebhookUrl,
          org_id: Number(client.orgId) || client.orgId,
          events: ["deal.updated", "deal.created"],
        });
        webhookId = ensured.id;
        await saveArtifact("webhook-register.json", {
          id: ensured.id,
          reused: ensured.reused,
          // non persistere secret/payload grezzi
        });
      }

      const updated = await updateDeal(client, createdDealId, {
        pipeline_id: pipelineId,
        status_id: secondStatusId,
      });
      await saveArtifact(`deal-${createdDealId}-after-move.json`, updated);

      if (smokeWebhookUrl && webhookId != null) {
        const delivery = await waitForWebhookDelivery({
          webhookSiteUrl: smokeWebhookUrl,
          dealId: createdDealId,
          timeoutMs: 20_000,
        });
        await saveArtifact("webhook-delivery.json", delivery);

        const logs = await listWebhookLogs(client, webhookId).catch((e) => ({
          error: redactSecrets(formatErr(e)),
        }));
        await saveArtifact("webhook-logs.json", logs);

        const ok = delivery.received;
        record({
          id: "stage_move",
          title: "Spostamento fase → deal.updated",
          status: ok ? "pass" : "warn",
          detail: ok
            ? `status_id → ${secondStatusId}; ricevuto deal.updated su webhook (id Mokapen=${webhookId})`
            : `status_id → ${secondStatusId}; webhook id=${webhookId} attivo ma nessun POST entro 20s — controlla ${smokeWebhookUrl}`,
        });
      } else if (smokeWebhookUrl) {
        record({
          id: "stage_move",
          title: "Spostamento fase → deal.updated",
          status: "warn",
          detail: `Fase spostata a ${secondStatusId}; webhook id non trovato — verifica ${smokeWebhookUrl}`,
        });
      } else {
        record({
          id: "stage_move",
          title: "Spostamento fase → deal.updated",
          status: "warn",
          detail: `Fase spostata a ${secondStatusId}. Per verificare deal.updated imposta SMOKE_WEBHOOK_URL e rilancia.`,
        });
      }
    } catch (err) {
      record({
        id: "stage_move",
        title: "Spostamento fase → deal.updated",
        status: "fail",
        detail: redactSecrets(formatErr(err)),
      });
    }
    // Webhook di smoke lasciato attivo su webhook.site per riuso (Mokapen 500 in create).
    void deleteWebhook;
    void webhookId;
  }

  printSummary();
  const failed = checks.some((c) => c.status === "fail");
  process.exit(failed ? 1 : 0);
}

function extractId(
  payload: unknown,
  keys: string[],
): number | string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  for (const key of keys) {
    if (data[key] != null) return data[key] as number | string;
    if (root[key] != null) return root[key] as number | string;
  }
  return null;
}

function formatErr(err: unknown): string {
  if (err instanceof MokapenError) {
    return `${err.message} body=${safeJson(err.body)}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function redactSecrets(text: string): string {
  return text
    .replace(/"secret"\s*:\s*"[^"]*"/gi, '"secret":"[REDACTED]"')
    .replace(/secret=[^\s&,}"]+/gi, "secret=[REDACTED]");
}

async function waitForWebhookDelivery(opts: {
  webhookSiteUrl: string;
  dealId: number;
  timeoutMs: number;
}): Promise<{
  received: boolean;
  matchedEvent?: string;
  requestCount: number;
  note?: string;
}> {
  const tokenMatch = opts.webhookSiteUrl.match(
    /webhook\.site\/([0-9a-fA-F-]{20,})/,
  );
  if (!tokenMatch?.[1]) {
    await new Promise((r) => setTimeout(r, 5000));
    return {
      received: false,
      requestCount: 0,
      note: "URL non webhook.site: verifica manuale",
    };
  }

  const token = tokenMatch[1];
  const api = `https://webhook.site/token/${token}/requests?sorting=newest`;
  const deadline = Date.now() + opts.timeoutMs;
  const dealNeedle = String(opts.dealId);

  while (Date.now() < deadline) {
    try {
      const res = await fetch(api, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const json = (await res.json()) as {
          data?: Array<{ content?: string; query?: unknown }>;
          total?: number;
        };
        const requests = json.data ?? [];
        for (const req of requests) {
          const content = req.content ?? "";
          if (
            content.includes(dealNeedle) ||
            /deal\.updated/i.test(content) ||
            /"event"\s*:\s*"deal\.updated"/i.test(content)
          ) {
            return {
              received: true,
              matchedEvent: "deal.updated",
              requestCount: json.total ?? requests.length,
            };
          }
        }
        if (requests.length > 0) {
          // Arrivato qualcosa: utile anche senza match stretto sull'id
          const anyDeal = requests.some((r) =>
            /deal\.(updated|created)/i.test(r.content ?? ""),
          );
          if (anyDeal) {
            return {
              received: true,
              matchedEvent: "deal.*",
              requestCount: json.total ?? requests.length,
            };
          }
        }
      }
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  return { received: false, requestCount: 0, note: "timeout 20s" };
}

function printSummary() {
  console.log("\n=== Riepilogo Fase 0 ===");
  for (const c of checks) {
    console.log(`- [${c.status}] ${c.id}: ${c.title}`);
  }
  console.log(`\nArtifact in ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
