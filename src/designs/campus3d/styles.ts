import type { CampusBuilding } from '../fixtures'
import type { BuildingSource } from '../campusData'

// Architectural vocabularies observed in photographs of IIT Roorkee (see
// docs/building-research.txt). Each style is a parametric recipe, not a survey.
export type StyleId = 'colonial' | 'sandstone' | 'grid' | 'hostel' | 'sandblock' | 'concrete' | 'plain'
export type Style = {
  id: StyleId
  wall: string; trim: string; base: string; roof: string; glass: string
  accent: string; accent2: string
  bay: number          // metres between window axes
  win: number          // window width as a fraction of the bay
  sill: number; head: number   // window sill/head as fractions of floor height
  floorH: number       // typical storey height, metres
}

export const styles: Record<StyleId, Style> = {
  // James Thomason (Main) Building: cream plaster, white Roman columns, arched openings.
  colonial: { id:'colonial', wall:'#efe5cc', trim:'#fbf7ea', base:'#cfc3a4', roof:'#d9d0b8', glass:'#4f6a7c', accent:'#8d6b4b', accent2:'#6e5a40', bay:4.6, win:.46, sill:.2, head:.82, floorH:6.2 },
  // Central library: pink sandstone piers with floor-to-ceiling glazing.
  sandstone: { id:'sandstone', wall:'#dcae93', trim:'#c98f73', base:'#b97d65', roof:'#cfc4ad', glass:'#4a6c85', accent:'#a96a52', accent2:'#8d5a46', bay:4.2, win:.78, sill:.08, head:.94, floorH:4.2 },
  // 1960s departments: white concrete frame, terracotta infill, deep window recesses.
  grid: { id:'grid', wall:'#c9744d', trim:'#f1ede2', base:'#a85d3e', roof:'#cbc3b0', glass:'#586f85', accent:'#e8e2d0', accent2:'#b36848', bay:3.6, win:.52, sill:.32, head:.8, floorH:3.9 },
  // Hostels (Bhawans): plaster blocks, balconies, terracotta doors with teal frames.
  hostel: { id:'hostel', wall:'#f2eadb', trim:'#ffffff', base:'#cdbfa6', roof:'#d6cdb8', glass:'#5a7488', accent:'#c4613b', accent2:'#3f8f8a', bay:3.4, win:.4, sill:.3, head:.78, floorH:3.4 },
  // Lecture halls / activity blocks: sand render with narrow tall glazing.
  sandblock: { id:'sandblock', wall:'#dcc9a3', trim:'#efe5cd', base:'#b9a681', roof:'#cdc3ab', glass:'#4d6379', accent:'#8f7b57', accent2:'#6f5f45', bay:3.0, win:.4, sill:.14, head:.9, floorH:4.0 },
  // Students Activity Centre: white board-marked concrete.
  concrete: { id:'concrete', wall:'#e8e5dc', trim:'#f7f5ee', base:'#c9c4b6', roof:'#d4cfc2', glass:'#4a6376', accent:'#c9c4b6', accent2:'#8d887a', bay:3.4, win:.55, sill:.22, head:.88, floorH:4.0 },
  plain: { id:'plain', wall:'#e9dfc8', trim:'#f6efdc', base:'#c8bba0', roof:'#d3cab4', glass:'#627a8d', accent:'#b79c76', accent2:'#8d7a5b', bay:3.3, win:.38, sill:.28, head:.76, floorH:3.4 },
}

const landmarkStyle: Record<string, StyleId> = {
  'osm-relation-8255183': 'colonial',
  mgcl: 'sandstone',
  lhc: 'sandblock', mac: 'sandblock', 'osm-way-1080933906': 'sandblock',
  sac: 'concrete',
  rajendra: 'hostel', ravindra: 'hostel', cautley: 'hostel', govind: 'hostel',
  civil: 'grid', electrical: 'grid', ece: 'grid', mechanical: 'grid',
}

/** Small deterministic hash for choosing between equivalent styles. */
export function hashOf(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) / 4294967295
}

export function styleFor(b: CampusBuilding, source: BuildingSource): Style {
  const direct = landmarkStyle[b.id]
  if (direct) return styles[direct]
  const text = `${b.name} ${source.buildingType}`
  if (b.kind === 'Residence' || /bhawan|bhavan|hostel|apartment|residential|dormitory|house/i.test(text)) return styles.hostel
  if (b.kind === 'Library') return styles.sandstone
  if (b.kind === 'Department' || /department|engineering|architecture|planning|management|institute|school|centre|center|laborator|workshop/i.test(text)) return styles.grid
  if (b.kind === 'Student life' || /hall|activity|club|gym|auditorium|canteen|mess/i.test(text)) return styles.sandblock
  if (b.kind === 'Academic') return hashOf(b.id) > .5 ? styles.sandblock : styles.grid
  return styles.plain
}

/** Buildings drawn with framed windows, columns, balconies and rooftop detail. */
export function isDetailed(b: CampusBuilding) {
  return !!(b.auditScope || b.id in landmarkStyle || b.named)
}
