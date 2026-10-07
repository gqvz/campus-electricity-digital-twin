import manifest from './campus/manifest.json'
import roads from './campus/roads.json'
import surfaces from './campus/surfaces.json'
import trees from './campus/trees.json'
import buildings0 from './campus/buildings-0.json'
import buildings1 from './campus/buildings-1.json'
import buildings2 from './campus/buildings-2.json'
import buildings3 from './campus/buildings-3.json'
import buildings4 from './campus/buildings-4.json'
export type GeographicPoint = [number, number]
export type GeographicRing = { role: string; wayIds: number[]; coordinates: GeographicPoint[] }
export type BuildingSource = {
  id: string; source: string; sourceName: string; version: number; updatedAt: string;
  buildingType: string; levels: string|null; height: string|null; roofShape: string|null;
  nameInference: string|null; rings: GeographicRing[];
}
export const mappedSources = [...buildings0,...buildings1,...buildings2,...buildings3,...buildings4] as BuildingSource[]
export const campusMap = { manifest, roads, surfaces, trees }
