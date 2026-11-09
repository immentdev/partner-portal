/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

import { z } from "zod";

const vatRegex = /^(IT)?[0-9]{11}$/i;

export const createReferralSchema = z.object({
  company_name: z.string().trim().min(2).max(200),
  vat_number: z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .refine((v) => vatRegex.test(v), "P.IVA non valida (11 cifre, opz. prefisso IT)"),
  website: z
    .union([z.string().trim().url(), z.literal("")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  contact_name: z.string().trim().min(2).max(120),
  contact_email: z.string().trim().email(),
  contact_phone: z.string().trim().max(40).optional(),
  product: z.string().trim().max(200).optional(),
  relationship_nature: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type CreateReferralInput = z.infer<typeof createReferralSchema>;

export function normalizeVat(vat: string): string {
  return vat.replace(/\s+/g, "").toUpperCase().replace(/^IT/, "");
}
