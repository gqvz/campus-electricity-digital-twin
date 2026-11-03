import { describe, expect, it } from 'vitest'
import type { Case } from '../designs/fixtures'
import { energyCoverage, summarize } from './summary'

const c = (o: Partial<Case>): Case => ({ id: 'x', buildingId: 'b', floor: 0, zone: 'z', hour: 20, time: '20:00', count: 1, unitWatts: 100, device: 'Lights', recommendation: '', ...o })

describe('summarize', () => {
  it('sums watts across sightings and claims no energy without a duration', () => {
    const s = summarize([c({ count: 2, unitWatts: 50 }), c({ count: 1, unitWatts: 20 })])
    expect(s).toMatchObject({ sightings: 2, watts: 120, verified: 0, kwh: null, unverifiedWatts: 120 })
    expect(energyCoverage(s)).toMatch(/no energy is claimed/)
  })
  it('counts energy only from verified sightings and says how many', () => {
    const s = summarize([c({ count: 8, unitWatts: 65, verifiedHours: 1.5 }), c({ count: 1, unitWatts: 1200 })])
    expect(s.watts).toBe(1720)
    expect(s.kwh).toBeCloseTo(0.78, 5)
    expect(s.unverifiedWatts).toBe(1200)
    expect(energyCoverage(s)).toBe('From 1 of 2 sightings with a verified duration; the other 1 support watts only.')
  })
  it('handles no sightings', () => {
    expect(summarize([])).toMatchObject({ sightings: 0, watts: 0, kwh: null })
  })
})
