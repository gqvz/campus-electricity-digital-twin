import { describe, expect, it } from 'vitest'
import { auditBuildings, campusBuildings } from './fixtures'
import { mappedSources, campusMap, effectiveRings } from './campusData'
import { campusStats, distanceToRing, footprintFor, footprintSources, geographicToLocal, geographicToScene, metersPerSceneUnit, pointInPolygon, ringsToScene } from './buildingGeometry'
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
      const rings=effectiveRings(source)
      expect(shape).toHaveLength(rings.length)
      for(let i=0;i<rings.length;i++) {
        const actual=shape[i].points
        for(const p of rings[i].coordinates as [number,number][]) {
          const expected=geographicToLocal(p)
          expect(actual.some(a=>Math.abs(a[0]*metersPerSceneUnit-expected[0])<1e-8&&Math.abs(a[1]*metersPerSceneUnit-expected[1])<1e-8)).toBe(true)
        }
      }
    }
  })
  it('keeps satellite-refined outlines inside the OSM envelope and labels the basis', () => {
    const refined=mappedSources.filter(s=>s.refinedRings)
    expect(refined.length).toBeGreaterThan(0)
    for(const source of refined) {
      expect(source.refinement,source.id).toMatch(/satellite/i)
      expect(source.rings.length,source.id).toBeGreaterThan(0)       // original OSM rings are preserved
      const osm=source.rings.flatMap(r=>r.coordinates), fixed=source.refinedRings!.flatMap(r=>r.coordinates)
      const box=(pts:number[][])=>[Math.min(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[1]))]
      const [a,b,c,d]=box(osm),[e,f,g,h]=box(fixed),pad=6e-5 // about 6 m
      expect(e).toBeGreaterThanOrEqual(a-pad);expect(f).toBeLessThanOrEqual(b+pad)
      expect(g).toBeGreaterThanOrEqual(c-pad);expect(h).toBeLessThanOrEqual(d+pad)
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
    for(const [id,pin] of pins) {
      // The pin identifies the OSM department outline; a satellite-refined outline may leave lawn at the pin.
      const osm=ringsToScene(footprintSources[id].rings)
      expect(osm.filter(r=>r.role==='outer').some(r=>pointInPolygon(geographicToScene(pin),r.points)),id).toBe(true)
      const drawn=footprintFor(campusBuildings.find(b=>b.id===id)!).filter(r=>r.role==='outer')
      expect(Math.min(...drawn.map(r=>distanceToRing(geographicToScene(pin),r.points)))*metersPerSceneUnit,id).toBeLessThan(40)
    }
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
