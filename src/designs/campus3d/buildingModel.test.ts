import { describe, expect, it } from 'vitest'
import { campusBuildings } from '../fixtures'
import { pointInPolygon } from '../buildingGeometry'
import { THOMASON_ID, modelFor, ringsInMetres, thomasonAnchors } from './buildingModel'
import { buildGround, buildRoads, buildSurfaces, buildTrees, boundaryMetres } from './terrain'
import { styleFor } from './styles'
import { footprintSources } from '../buildingGeometry'

describe('3D building models', () => {
  it('generates finite, non-empty geometry for every mapped building', () => {
    for (const b of campusBuildings) {
      const m = modelFor(b)
      const pos = m.solid.getAttribute('position')
      expect(pos.count, b.id).toBeGreaterThan(0)
      expect(Array.from(pos.array).every(Number.isFinite), b.id).toBe(true)
      expect(Array.from(m.glass.getAttribute('position').array).every(Number.isFinite), b.id).toBe(true)
      expect(m.topY).toBeGreaterThan(1)
    }
  })

  it('keeps every wall and roof inside its footprint bounds (no invented plan area)', () => {
    for (const b of campusBuildings.filter(x => x.auditScope)) {
      const m = modelFor(b)
      const pts = ringsInMetres(b).flatMap(r => r.points)
      const xs = pts.map(p => p[0]), zs = pts.map(p => p[1])
      m.solid.computeBoundingBox()
      const box = m.solid.boundingBox!
      // Balconies, plazas and roof frames may overhang by a few metres, not tens.
      expect(box.min.x).toBeGreaterThan(Math.min(...xs) - 9)
      expect(box.max.x).toBeLessThan(Math.max(...xs) + 9)
      expect(box.min.z).toBeGreaterThan(Math.min(...zs) - 9)
      expect(box.max.z).toBeLessThan(Math.max(...zs) + 9)
    }
  })

  it('places Thomason dome, portico and tower on solid footprint, outside the courtyard', () => {
    const b = campusBuildings.find(x => x.id === THOMASON_ID)!
    const rings = ringsInMetres(b), outer = rings.filter(r => r.role === 'outer'), inner = rings.filter(r => r.role === 'inner')
    expect(inner.length).toBeGreaterThan(0)
    for (const key of ['dome', 'tower'] as const) {
      const p = thomasonAnchors[key]
      expect(outer.some(r => pointInPolygon(p, r.points)), key).toBe(true)
      expect(inner.some(r => pointInPolygon(p, r.points)), key).toBe(false)
    }
    const m = modelFor(b)
    expect(m.topY).toBeCloseTo(12.6, 1)
    m.solid.computeBoundingBox()
    expect(m.solid.boundingBox!.max.y).toBeGreaterThan(30) // dome lantern and tower rise above the wings
  })

  it('assigns the researched architectural vocabularies', () => {
    const style = (id: string) => styleFor(campusBuildings.find(b => b.id === id)!, footprintSources[id]).id
    expect(style(THOMASON_ID)).toBe('colonial')
    expect(style('mgcl')).toBe('sandstone')
    expect(style('cautley')).toBe('hostel')
    expect(style('civil')).toBe('grid')
    expect(style('sac')).toBe('concrete')
  })

  it('keeps the MAC courtyard open', () => {
    const rings = ringsInMetres(campusBuildings.find(b => b.id === 'mac')!)
    expect(rings.filter(r => r.role === 'inner')).toHaveLength(1)
  })
})

describe('3D terrain', () => {
  it('builds ground, surfaces, roads and vegetation', () => {
    expect(boundaryMetres.length).toBeGreaterThan(10)
    for (const g of [buildGround(), buildSurfaces(), buildRoads()]) {
      expect(g.getAttribute('position').count).toBeGreaterThan(0)
      expect(Array.from(g.getAttribute('position').array).every(Number.isFinite)).toBe(true)
    }
    const trees = buildTrees([])
    expect(trees.mapped).toBe(17)
    expect(trees.geometry.getAttribute('position').count).toBeGreaterThan(0)
  })
})
