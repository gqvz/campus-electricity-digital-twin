import { describe, expect, it } from 'vitest'
import { HEAT_RAMP, heatBin } from './heat'

describe('heatBin', () => {
  it('marks buildings without observed load as no data', () => {
    expect(heatBin(0, 5000)).toBe(-1)
    expect(heatBin(100, 0)).toBe(-1)
  })
  it('puts the busiest building in the top bin and small loads in the bottom bin', () => {
    expect(heatBin(5000, 5000)).toBe(HEAT_RAMP.length - 1)
    expect(heatBin(1, 5000)).toBe(0)
  })
  it('is monotonic', () => {
    const bins = [100, 900, 1900, 2900, 3900, 5000].map(w => heatBin(w, 5000))
    expect([...bins].sort((a, b) => a - b)).toEqual(bins)
  })
})
