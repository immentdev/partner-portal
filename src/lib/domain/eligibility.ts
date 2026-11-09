/**
 * Partner Portal BAC × Imment
 * Autore: Giuseppe Pistoia · © Imment S.r.l.
 */

/**
 * eligible = signed_at <= window_end.
 * Se non firmato, null.
 */
export function computeEligible(
  signedAt: string | Date | null | undefined,
  windowEnd: string | Date | null | undefined,
): boolean | null {
  if (!signedAt) return null;
  if (!windowEnd) return null;
  const signed = signedAt instanceof Date ? signedAt : new Date(signedAt);
  const end = windowEnd instanceof Date ? windowEnd : new Date(windowEnd);
  if (Number.isNaN(signed.getTime()) || Number.isNaN(end.getTime())) return null;
  return signed.getTime() <= end.getTime();
}

export function addMonths(isoOrDate: string | Date, months: number): string {
  const d = isoOrDate instanceof Date ? new Date(isoOrDate) : new Date(isoOrDate);
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}
