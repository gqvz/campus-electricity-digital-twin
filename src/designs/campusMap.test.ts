import { describe, expect, it } from 'vitest'
import { auditBuildings, campusBuildings } from './fixtures'
import { mappedSources, campusMap } from './campusData'
import { campusStats, distanceToRing, footprintFor, footprintSources, geographicToLocal, geographicToScene, metersPerSceneUnit, pointInPolygon } from './buildingGeometry'
import type { Point2 } from './buildingGeometry'

describe('one geographic campus', () => {
  it('imports the mapped campus without duplicating multipolygon members', () => {
    expect(campusBuildings).toHaveLength(campusStats.buildings)
    expect(campusStats.buildings).toBe(231)
    expect(auditBuildings).toHaveLength(12)
    expect(new Set(campusBuildings.map(b=>b.id)).size).toBe(campusStats.buildings)
    const ownedWays=mappedSources.flatMap(s=>s.rings.flatMap(r=>r.wayIds))
    expect(new Set(ownedWays).size).toBe(ownedWays.length)
    expect(campusMap.manifest.diagnostics).toEqual([])
  })
  it('preserves every source vertex at the same scale and position', () => {
    for(const b of campusBuildings) {
      const source=footprintSources[b.id]
      const shape=footprintFor(b)
      for(let i=0;i<source.rings.length;i++) {
        const actual=shape[i].points
        for(const p of source.rings[i].coordinates) {
          const expected=geographicToLocal(p)
          expect(actual.some(a=>Math.abs(a[0]*metersPerSceneUnit-expected[0])<1e-8&&Math.abs(a[1]*metersPerSceneUnit-expected[1])<1e-8)).toBe(true)
        }
      }
    }
  })
  it('retains north/south/east/west relationships and relative widths', () => {
    const center=(id:string)=>{const b=campusBuildings.find(b=>b.id===id)!;return [b.x+b.w/2,b.y+b.d/2]}
    expect(center('mac')[1]).toBeLessThan(center('mgcl')[1])
    expect(center('mgcl')[0]).toBeGreaterThan(center('lhc')[0])
    expect(center('sac')[0]).toBeGreaterThan(center('mgcl')[0])
    expect(center('govind')[1]).toBeGreaterThan(center('mac')[1])
    const library=campusBuildings.find(b=>b.id==='mgcl')!,hostel=campusBuildings.find(b=>b.id==='cautley')!
    expect(hostel.w/library.w).toBeGreaterThan(3)
  })
  it('cross-checks IITR-published Google Maps pins against imported polygons', () => {
    const pins:[string,Point2][]=[['mac',[77.8963333,29.8700825]],['mechanical',[77.8973362,29.8626681]]]
    for(const [id,pin] of pins)expect(footprintFor(campusBuildings.find(b=>b.id===id)!).filter(r=>r.role==='outer').some(r=>pointInPolygon(geographicToScene(pin),r.points)),id).toBe(true)
    // APJ's published pin is ~0.2 m outside the envelope, not inside it.
    // Name matching is proximity evidence, not a surveyed building identity.
    const apj=footprintFor(campusBuildings.find(b=>b.id==='osm-way-1080933906')!)[0]
    const pin=geographicToScene([77.8940776,29.8658641])
    expect(pointInPolygon(pin,apj.points)).toBe(false)
    expect(distanceToRing(pin,apj.points)*metersPerSceneUnit).toBeLessThan(1)
  })
  it('retains Govind courtyard and key campus landmarks', () => {
    expect(footprintSources.govind.source).toContain('relation/6110956')
    expect(footprintSources.govind.rings.some(r=>r.role==='inner')).toBe(true)
    expect(campusBuildings.find(b=>b.id==='osm-relation-8255183')?.name).toBe('James Thomason Building')
    expect(campusStats.roads).toBe(229)
  })
})
