import { describe, expect, it } from 'vitest'
import { campusBuildings } from './fixtures'
import { footprintFor, footprintSources, geographicToLocal, localToGeographic, outlineEdges, signedArea } from './buildingGeometry'

describe('sourced building outlines', () => {
  it('provides finite polygon geometry inside geographic bounds for every mapped building', () => {
    for (const b of campusBuildings) {
      const rings = footprintFor(b)
      expect(rings.length).toBeGreaterThan(0)
      for (const ring of rings) {
        expect(ring.points.length).toBeGreaterThanOrEqual(3)
        expect(Math.abs(signedArea(ring.points))).toBeGreaterThan(0)
        for (const [x,y] of ring.points) {
          expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true)
          expect(x).toBeGreaterThanOrEqual(b.x-1e-9)
          expect(x).toBeLessThanOrEqual(b.x+b.w+1e-9)
          expect(y).toBeGreaterThanOrEqual(b.y-1e-9)
          expect(y).toBeLessThanOrEqual(b.y+b.d+1e-9)
        }
      }
      expect(outlineEdges(rings).every(e=>e.length>0 && e.normal.every(Number.isFinite))).toBe(true)
    }
  })
  it('retains MAC courtyard holes and all three separate volumes', () => {
    const b = campusBuildings.find(b=>b.id==='mac')!
    const rings=footprintFor(b)
    expect(rings.filter(r=>r.role==='outer')).toHaveLength(3)
    expect(rings.filter(r=>r.role==='inner')).toHaveLength(1)
    expect(rings.filter(r=>r.role==='outer').every(r=>signedArea(r.points)>0)).toBe(true)
    expect(rings.filter(r=>r.role==='inner').every(r=>signedArea(r.points)<0)).toBe(true)
  })
  it('joins Ravindra split ways into one closed outline', () => {
    expect(footprintSources.ravindra.rings).toHaveLength(1)
    expect(footprintSources.ravindra.rings[0].wayIds).toHaveLength(2)
  })
  it('preserves geographic round trips and uniform scaling', () => {
    expect(localToGeographic(geographicToLocal([77.896604,29.8702343]))).toEqual([77.896604,29.8702343])
    const b = campusBuildings.find(b=>b.id==='lhc')!
    const source = footprintSources.lhc.rings[0].coordinates.map(p=>geographicToLocal(p as [number,number]))
    const shape = footprintFor(b)[0].points
    const sx = Math.max(...source.map(p=>p[0]))-Math.min(...source.map(p=>p[0]))
    const sy = Math.max(...source.map(p=>p[1]))-Math.min(...source.map(p=>p[1]))
    const x = Math.max(...shape.map(p=>p[0]))-Math.min(...shape.map(p=>p[0]))
    const y = Math.max(...shape.map(p=>p[1]))-Math.min(...shape.map(p=>p[1]))
    expect(x/y).toBeCloseTo(sx/sy,8)
  })
})
