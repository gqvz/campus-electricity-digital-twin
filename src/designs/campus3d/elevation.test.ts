import { describe, expect, it } from 'vitest'
import { campusBuildings } from '../fixtures'
import { metersPerSceneUnit } from '../buildingGeometry'
import { datum, elevationAtLocal, groundY, reliefMetres } from './elevation'
import { boundaryMetres, buildGround, buildRoads, buildSurfaces } from './terrain'
import { modelFor } from './buildingModel'

const at = (id: string) => {
  const b = campusBuildings.find(x => x.id === id)!
  return elevationAtLocal((b.x + b.w / 2) * metersPerSceneUnit, (b.y + b.d / 2) * metersPerSceneUnit)
}

describe('campus terrain', () => {
  it('has the plateau around the Main Building above Rajiv and Jawahar Bhawan', () => {
    const main = at('osm-relation-8255183')
    expect(main - at('osm-relation-11284811')).toBeGreaterThan(3)   // Rajiv Bhawan
    expect(main - at('osm-way-408149336')).toBeGreaterThan(3)       // Jawahar Bhawan Mess
  })
  it('stays within a believable range', () => {
    expect(reliefMetres).toBeGreaterThan(5)
    expect(reliefMetres).toBeLessThan(30)
    for (const [x, z] of boundaryMetres) expect(Number.isFinite(groundY(x, z))).toBe(true)
  })
  it('scales heights about the datum and keeps buildings finite', () => {
    const [x, z] = boundaryMetres[0]
    expect(groundY(x, z, 3)).toBeCloseTo(groundY(x, z, 1) * 3, 6)
    for (const b of campusBuildings.slice(0, 40)) {
      const g = modelFor(b).ground
      expect(g.min).toBeLessThanOrEqual(g.mean)
      expect(g.mean).toBeLessThanOrEqual(g.max)
      expect(g.mean).toBeGreaterThanOrEqual(-1)
    }
    expect(datum).toBeGreaterThan(200)
  })
  it('builds draped ground, surfaces and roads', () => {
    for (const g of [buildGround(1), buildSurfaces(1), buildRoads(1)]) {
      expect(g.getAttribute('position').count).toBeGreaterThan(0)
      expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true)
    }
  })
})
