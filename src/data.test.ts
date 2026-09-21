import { describe, expect, it } from 'vitest'
import { calculateVerifiedEnergy } from './data'

describe('calculateVerifiedEnergy', () => {
  it('converts a verified watt-hour duration to kWh', () => {
    expect(calculateVerifiedEnergy(890, 3)).toBe(2.67)
  })

  it('does not invent kWh when duration is missing or invalid', () => {
    expect(calculateVerifiedEnergy(890)).toBeNull()
    expect(calculateVerifiedEnergy(890, 0)).toBeNull()
  })
})
