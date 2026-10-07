import type { CampusBuilding } from './fixtures'
import { mappedSources, campusMap } from './campusData'
import type { BuildingSource } from './campusData'

export type Point2 = [number, number]
export type FootprintRing = { role: string; points: Point2[] }
export const footprintSources: Record<string, BuildingSource> = Object.fromEntries(mappedSources.map(b=>[b.id,b]))
// One shared world scale: source metres -> scene units, never per-building fit.
export const metersPerSceneUnit = 50
export const verticalPixelsPerMeter = 32 / metersPerSceneUnit
export const origin: Point2 = [77.895, 29.865]
const metersPerDegree = 111_320
const longitudeScale = metersPerDegree * Math.cos(origin[1] * Math.PI / 180)
export function geographicToLocal([lon, lat]: Point2): Point2 {
  return [(lon - origin[0]) * longitudeScale, (origin[1] - lat) * metersPerDegree]
}
export function localToGeographic([east, south]: Point2): Point2 {
  return [origin[0] + east / longitudeScale, origin[1] - south / metersPerDegree]
}
export function signedArea(points: Point2[]) {
  return points.reduce((sum, a, i) => { const b = points[(i + 1) % points.length]; return sum + a[0] * b[1] - b[0] * a[1] }, 0) / 2
}
export function geographicToScene(p: Point2): Point2 {
  return geographicToLocal(p).map(v=>v/metersPerSceneUnit) as Point2
}
export function ringsToScene(rings: BuildingSource['rings']): FootprintRing[] {
  return rings.map(r => {
    const points=r.coordinates.map(geographicToScene)
    if ((signedArea(points)>0)!==(r.role==='outer'))points.reverse()
    return {role:r.role,points}
  })
}
const footprintCache=new Map<string,FootprintRing[]>()
export function footprintFor(b: CampusBuilding): FootprintRing[] {
  let rings=footprintCache.get(b.id)
  if(!rings){rings=ringsToScene(footprintSources[b.id].rings);footprintCache.set(b.id,rings)}
  return rings
}
export function layoutForSource(source: BuildingSource) {
  const rings=ringsToScene(source.rings)
  const all = rings.flatMap(r => r.points)
  const minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0]))
  const minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]))
  return {x:minX,y:minY,w:maxX-minX,d:maxY-minY}
}
export const campusBoundary = campusMap.manifest.boundary.coordinates.map(p=>geographicToScene(p as Point2))
export const campusStats = campusMap.manifest.statistics
export function pointInPolygon([x,y]:Point2, ring:Point2[]) {
  let inside=false
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j]
    if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside
  }
  return inside
}
export function distanceToRing(point:Point2, ring:Point2[]) {
  return Math.min(...ring.map((a,i)=>{
    const b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1]
    const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy||1)))
    return Math.hypot(point[0]-a[0]-t*dx,point[1]-a[1]-t*dy)
  }))
}
export function outlineEdges(rings: FootprintRing[]) {
  return rings.flatMap(r => r.points.map((a, i) => {
    const b = r.points[(i + 1) % r.points.length]
    const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy)
    // Rings have opposite winding for courtyard walls.
    return { a, b, length, normal: [dy / length, -dx / length] as Point2, role: r.role }
  }))
}
