import { describe, expect, it } from 'vitest'
import { kwh, verifiedHoursBetween, watts } from './calc'

describe('electricity calculations', () => {
  it('computes avoidable load as count x watts', () => {
    expect(watts(8, 65)).toBe(520)
  })
  it('never invents energy from a single sighting', () => {
    expect(kwh(520, null)).toBeNull()
    expect(kwh(520, undefined)).toBeNull()
    expect(kwh(520, 0)).toBeNull()
  })
  it('converts a verified duration to kWh', () => {
    expect(kwh(520, 1.5)).toBeCloseTo(0.78, 5)
  })
  it('accepts only a later, same-day-scale verification time', () => {
    expect(verifiedHoursBetween('2026-10-14T20:35:00+05:30', '2026-10-14T22:05:00+05:30')).toBe(1.5)
    expect(verifiedHoursBetween('2026-10-14T20:35:00+05:30', '2026-10-14T20:00:00+05:30')).toBeNull()
    expect(verifiedHoursBetween('2026-10-14T20:35:00+05:30', null)).toBeNull()
    expect(verifiedHoursBetween('2026-10-14T01:00:00+05:30', '2026-10-16T01:00:00+05:30')).toBeNull()
  })
})
