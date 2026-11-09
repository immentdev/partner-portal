/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 *
 * Crea su Mokapen azienda, contatto, deal (pipeline Partner) e task PP.
 */

import { MokapenClient } from "./client";
import {
  companyIdOf,
  findCompaniesByVat,
  storeCompany,
} from "./companies";
import { dealIdOf, storeDeal } from "./deals";
import { splitFullName, storeContact } from "./contacts";
import { connectRecords, storeTask } from "./tasks";
import { PARTNER_PIPELINE_ID } from "@/lib/domain/macrostate";

/** status_id «Nuovo lead» — pipeline Partner 585 (Fase 0). */
export const NUOVO_LEAD_STATUS_ID = 18713;

export type MokapenReferralCreateInput = {
  companyName: string;
  vatNumber: string;
  website?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  product?: string;
  relationshipNature?: string;
  notes?: string;
  referralCode: string;
  territoryCode: string;
  /** Company Mokapen dell'Associazione BAC (partner sul deal). */
  partnerCompanyId?: number | null;
  /** Contatto Mokapen del segnalatore. */
  referrerContactId?: number | null;
};

export type MokapenReferralCreateResult = {
  companyId: number | null;
  contactId: number | null;
  dealId: number;
  taskCreated: boolean;
  reusedCompany: boolean;
  mokapenDuplicateHit: boolean;
};

function unwrapCompanyId(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;
  const info =
    (data.info_company as Record<string, unknown> | undefined) ??
    (data.company as Record<string, unknown> | undefined) ??
    data;
  const id = info.company_id ?? info.id;
  return id != null ? Number(id) : null;
}

export async function createReferralOnMokapen(
  input: MokapenReferralCreateInput,
  client = MokapenClient.fromEnv(),
): Promise<MokapenReferralCreateResult> {
  await client.ensureToken();

  const vatSearch = await findCompaniesByVat(client, input.vatNumber);
  const candidates = [
    ...vatSearch.vatFilter,
    ...vatSearch.legalOwnerVatFilter,
    ...vatSearch.search,
  ];
  const existing = candidates.find((c) => companyIdOf(c) != null) ?? null;
  const mokapenDuplicateHit = existing != null;

  let companyId = existing ? companyIdOf(existing) : null;
  let reusedCompany = Boolean(companyId);

  if (!companyId) {
    const created = await storeCompany(client, {
      title: input.companyName,
      vat: input.vatNumber.replace(/^IT/i, ""),
      legal_owner_vat: input.vatNumber.replace(/^IT/i, ""),
      description: input.website
        ? `Segnalata via Partner Portal. Web: ${input.website}`
        : "Segnalata via Partner Portal",
    });
    companyId = unwrapCompanyId(created);
    reusedCompany = false;
  }

  const { name, surname } = splitFullName(input.contactName);
  const contact = await storeContact(client, {
    name,
    surname,
    email1: input.contactEmail,
    phone1: input.contactPhone,
    description: `Referente segnalazione ${input.referralCode}`,
  });

  const pipelineId = Number(
    process.env.MOKAPEN_PARTNER_PIPELINE_ID ?? PARTNER_PIPELINE_ID,
  );

  const deal = await storeDeal(client, {
    title: `${input.companyName} · ${input.referralCode}`,
    pipeline_id: pipelineId,
    status_id: NUOVO_LEAD_STATUS_ID,
    business_id: companyId ?? undefined,
    description: [
      `Referral: ${input.referralCode}`,
      `Territorio: ${input.territoryCode}`,
      input.product ? `Prodotto: ${input.product}` : null,
      input.relationshipNature
        ? `Natura relazione: ${input.relationshipNature}`
        : null,
      input.notes ? `Note: ${input.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    source: "partner-portal",
    source_code: input.referralCode,
    type: input.product,
    type2: input.relationshipNature,
  });

  const dealId = dealIdOf(deal);
  if (!dealId) {
    throw new Error("Mokapen store_deal senza deal_id nel payload");
  }

  // Collegamenti: azienda, contatto referente, partner BAC, segnalatore
  if (companyId) {
    await connectRecords(client, "deals", dealId, "company", companyId).catch(
      () => undefined,
    );
  }
  if (contact.id) {
    await connectRecords(client, "deals", dealId, "contact", contact.id).catch(
      () => undefined,
    );
  }
  if (input.partnerCompanyId) {
    await connectRecords(
      client,
      "deals",
      dealId,
      "company",
      input.partnerCompanyId,
    ).catch(() => undefined);
  }
  if (input.referrerContactId) {
    await connectRecords(
      client,
      "deals",
      dealId,
      "contact",
      input.referrerContactId,
    ).catch(() => undefined);
  }

  let taskCreated = false;
  const ownerId = process.env.MOKAPEN_TASK_OWNER_ID?.trim();
  if (ownerId) {
    try {
      const task = await storeTask(client, {
        title: `Validare segnalazione ${input.referralCode}`,
        owner_id: Number(ownerId) || ownerId,
        description: `Nuova segnalazione Partner Portal\nDeal #${dealId}\n${input.companyName} (${input.vatNumber})`,
        status: "o",
      });
      taskCreated = true;
      const taskId =
        task && typeof task === "object"
          ? Number(
              (task as { data?: { task_id?: number; id?: number } }).data
                ?.task_id ??
                (task as { data?: { id?: number } }).data?.id ??
                (task as { task_id?: number }).task_id ??
                (task as { id?: number }).id,
            )
          : NaN;
      if (Number.isFinite(taskId)) {
        await connectRecords(client, "deals", dealId, "task", taskId).catch(
          () => undefined,
        );
      }
    } catch (err) {
      console.error("[mokapen] task create failed", err);
    }
  }

  return {
    companyId,
    contactId: contact.id,
    dealId,
    taskCreated,
    reusedCompany,
    mokapenDuplicateHit,
  };
}
