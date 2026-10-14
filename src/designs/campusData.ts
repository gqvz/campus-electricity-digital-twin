import manifest from './campus/manifest.json'
import roads from './campus/roads.json'
import surfaces from './campus/surfaces.json'
import trees from './campus/trees.json'
import buildings0 from './campus/buildings-0.json'
import buildings1 from './campus/buildings-1.json'
import buildings2 from './campus/buildings-2.json'
import buildings3 from './campus/buildings-3.json'
import buildings4 from './campus/buildings-4.json'
import refinements from './campus/refinements.json'
export type GeographicPoint = [number, number]
export type GeographicRing = { role: string; wayIds: number[]; coordinates: GeographicPoint[] }
export type BuildingSource = {
  id: string; source: string; sourceName: string; version: number; updatedAt: string;
  buildingType: string; levels: string|null; height: string|null; roofShape: string|null;
  nameInference: string|null; rings: GeographicRing[];
  // Satellite-review correction of the plan outline (courtyards, separate bars); `rings` stays the OSM source.
  refinedRings?: Omit<GeographicRing,'wayIds'>[]; refinement?: string;
  // Ground the OSM outline covered but satellite imagery shows open (lawns, courtyards between bars).
  openRings?: Omit<GeographicRing,'wayIds'>[];
}
const refinementById=refinements as unknown as Record<string,{basis:string;rings:Omit<GeographicRing,'wayIds'>[];open?:Omit<GeographicRing,'wayIds'>[]}>
export const mappedSources = ([...buildings0,...buildings1,...buildings2,...buildings3,...buildings4] as BuildingSource[]).map(source=>{
  const fix=refinementById[source.id]
  return fix?{...source,refinedRings:fix.rings,refinement:fix.basis,openRings:fix.open}:source
})
/** Rings used for drawing: the refined outline when one exists, otherwise the OSM source. */
export const effectiveRings=(source:BuildingSource)=>source.refinedRings??source.rings
export const campusMap = { manifest, roads, surfaces, trees }
