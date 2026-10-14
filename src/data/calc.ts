// The honesty rules from the audit method, as pure functions (also enforced in SQL).
/** Avoidable load: device count x watts per device. */
export const watts = (count: number, unitWatts: number) => count * unitWatts
/** kWh only when a verified duration exists. A single sighting never becomes energy. */
export const kwh = (w: number, verifiedHours?: number | null) =>
  verifiedHours != null && verifiedHours > 0 ? (w * verifiedHours) / 1000 : null
/** Hours between the sighting and a later shutdown/revisit timestamp; null if unsupported. */
export function verifiedHoursBetween(observedAt: string | Date, verifiedAt?: string | Date | null) {
  if (!verifiedAt) return null
  const ms = new Date(verifiedAt).getTime() - new Date(observedAt).getTime()
  const hours = ms / 3_600_000
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return null
  return Math.round(hours * 100) / 100
}
