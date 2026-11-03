import * as THREE from 'three'
import { MeshBatch } from './batch'
import { campusBoundary, geographicToScene, metersPerSceneUnit, pointInPolygon } from '../buildingGeometry'
import type { Point2 } from '../buildingGeometry'
import { campusMap, mappedSources } from '../campusData'
import { hashOf } from './styles'
import { groundY } from './elevation'

type P2 = [number, number]
const toMetres = (p: Point2): P2 => { const s = geographicToScene(p); return [s[0]*metersPerSceneUnit, s[1]*metersPerSceneUnit] }

export const boundaryMetres: P2[] = campusBoundary.map(p => [p[0]*metersPerSceneUnit, p[1]*metersPerSceneUnit])

function triangulate(outer: P2[], holes: P2[][] = []) {
  const contour = outer.map(p => new THREE.Vector2(p[0], p[1]))
  const holeV = holes.map(h => h.map(p => new THREE.Vector2(p[0], p[1])))
  const faces = THREE.ShapeUtils.triangulateShape(contour, holeV)
  return { pts: [...contour, ...holeV.flat()].map(v => [v.x, v.y] as P2), faces }
}

/** Split every triangle into four, `levels` times, so a flat polygon can follow the terrain. */
function* subdivide(tri: [P2, P2, P2], levels: number): Generator<[P2, P2, P2]> {
  if (levels === 0) { yield tri; return }
  const [a, b, c] = tri
  const ab: P2 = [(a[0]+b[0])/2, (a[1]+b[1])/2], bc: P2 = [(b[0]+c[0])/2, (b[1]+c[1])/2], ca: P2 = [(c[0]+a[0])/2, (c[1]+a[1])/2]
  for (const t of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]] as [P2, P2, P2][]) yield* subdivide(t, levels - 1)
}

/** Add a polygon to `b` following the ground. Every triangle splits the same number of times so edges stay joined. */
function addDraped(b: MeshBatch, pts: P2[], faces: number[][], lift: number, scale: number, color: string, maxEdge = 30) {
  let longest = 0
  for (const f of faces) for (let k = 0; k < 3; k++) {
    const p = pts[f[k]], q = pts[f[(k+1) % 3]]
    longest = Math.max(longest, Math.hypot(p[0]-q[0], p[1]-q[1]))
  }
  const levels = Math.min(6, Math.max(0, Math.ceil(Math.log2(longest / maxEdge))))
  const at = (p: P2): [number, number, number] => [p[0], groundY(p[0], p[1], scale) + lift, p[1]]
  for (const f of faces) for (const t of subdivide([pts[f[0]], pts[f[1]], pts[f[2]]], levels)) b.tri(at(t[0]), at(t[1]), at(t[2]), color, [0, 1, 0])
}

/** Break a polyline so no segment is longer than `maxLen`. */
function densify(pts: P2[], maxLen = 14): P2[] {
  const out: P2[] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i-1], c = pts[i], n = Math.max(1, Math.ceil(Math.hypot(c[0]-a[0], c[1]-a[1]) / maxLen))
    for (let k = 1; k <= n; k++) out.push([a[0] + (c[0]-a[0])*k/n, a[1] + (c[1]-a[1])*k/n])
  }
  return out
}

export function campusBounds() {
  const xs = boundaryMetres.map(p => p[0]), zs = boundaryMetres.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  return { minX, maxX, minZ, maxZ, cx: (minX+maxX)/2, cz: (minZ+maxZ)/2, w: maxX-minX, d: maxZ-minZ }
}

export const groundColors = { ground: '#e9d9af', side: '#cfbd8d' }

export function buildGround(scale = 1) {
  const b = new MeshBatch()
  const { pts, faces } = triangulate(boundaryMetres)
  addDraped(b, pts, faces, 0, scale, groundColors.ground, 30)
  const depth = 8
  const rim = densify([...boundaryMetres, boundaryMetres[0]], 30)
  for (let i = 0; i < rim.length - 1; i++) {
    const p = rim[i], q = rim[i+1]
    const yp = groundY(p[0], p[1], scale), yq = groundY(q[0], q[1], scale)
    b.quad([p[0], -depth, p[1]], [q[0], -depth, q[1]], [q[0], yq, q[1]], [p[0], yp, p[1]], groundColors.side)
    b.quad([p[0], yp, p[1]], [q[0], yq, q[1]], [q[0], -depth, q[1]], [p[0], -depth, p[1]], groundColors.side)
  }
  return b.build()
}

// Layers are separated by 4 cm steps or more: draped triangles are tessellated differently per
// polygon, so tiny offsets would cross each other and flicker (z-fighting).
const surfaceStyle = (type: string): { color: string; y: number } => {
  if (/education|residential/.test(type)) return { color: '#e4d8b0', y: .04 }
  if (/park/.test(type)) return { color: '#a7c288', y: .10 }
  if (/garden/.test(type)) return { color: '#b9cc9b', y: .10 }
  if (/swimming_pool|water/.test(type)) return { color: '#8bbdd6', y: .16 }
  if (/track/.test(type)) return { color: '#c9795a', y: .22 }
  if (/pitch|stadium|sports/.test(type)) return { color: '#a9c88f', y: .30 }
  if (/bleacher|seating/.test(type)) return { color: '#d7cfb8', y: .38 }
  return { color: '#b9cc9b', y: .10 }
}

export const lawnTypes = /garden|park/

export function buildSurfaces(scale = 1) {
  const b = new MeshBatch()
  for (const s of campusMap.surfaces) {
    const rings = s.rings.map(r => ({ role: r.role, points: (r.coordinates as Point2[]).map(toMetres) }))
    const outers = rings.filter(r => r.role === 'outer'), inners = rings.filter(r => r.role === 'inner')
    const { color, y } = surfaceStyle(s.type)
    for (const o of outers) {
      const holes = inners.filter(h => pointInPolygon(h.points[0], o.points)).map(h => h.points)
      const { pts, faces } = triangulate(o.points, holes)
      addDraped(b, pts, faces, y, scale, color, 22)
      // Pitches and tracks get a white boundary line.
      if (/pitch|track/.test(s.type)) {
        const ring = densify([...o.points, o.points[0]], 12)
        for (let i = 0; i < ring.length - 1; i++) {
          const a = ring[i], c = ring[i+1], dx = c[0]-a[0], dz = c[1]-a[1], l = Math.hypot(dx, dz) || 1
          const nx = -dz/l*.35, nz = dx/l*.35, ya = groundY(a[0], a[1], scale) + y + .05, yc = groundY(c[0], c[1], scale) + y + .05
          b.quad([a[0]-nx,ya,a[1]-nz], [c[0]-nx,yc,c[1]-nz], [c[0]+nx,yc,c[1]+nz], [a[0]+nx,ya,a[1]+nz], '#fffaf0', [0,1,0])
        }
      }
    }
  }
  // Courtyards and lawns that building outlines enclose (mapped courtyards plus satellite-reviewed open ground).
  const lawn = '#b3c993'
  for (const source of mappedSources) {
    const open = source.openRings ?? []
    const rings = (source.refinedRings ?? source.rings).filter(r => r.role === 'inner')
    for (const r of [...open.filter(o => o.role === 'outer'), ...rings]) {
      const pts = (r.coordinates as Point2[]).map(toMetres)
      if (pts.length < 3) continue
      const { pts: tp, faces } = triangulate(pts, open.filter(o => o.role === 'inner' && r.role === 'outer').map(o => (o.coordinates as Point2[]).map(toMetres)).filter(h => pointInPolygon(h[0], pts)))
      addDraped(b, tp, faces, .13, scale, lawn, 22)
    }
  }
  return b.build()
}

const roadWidth = (type: string, width: string | null) => {
  const w = Number.parseFloat(width ?? '')
  if (Number.isFinite(w) && w > 0) return w
  if (/footway|path|cycleway|pedestrian/.test(type)) return 1.8
  if (/steps/.test(type)) return 2
  if (/service/.test(type)) return 4
  if (/tertiary/.test(type)) return 9
  if (/unclassified/.test(type)) return 5.5
  return 6
}

export function buildRoads(scale = 1) {
  const b = new MeshBatch()
  for (const r of campusMap.roads) {
    const pts = densify((r.coordinates as Point2[]).map(toMetres), 14), w = roadWidth(r.type, r.width), half = w/2
    const walk = /footway|path|cycleway|pedestrian|steps/.test(r.type)
    const color = walk ? '#fffdf2' : r.type === 'construction' ? '#e0d6bd' : '#f7efd9', y = walk ? .62 : .52
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], c = pts[i+1], dx = c[0]-a[0], dz = c[1]-a[1], l = Math.hypot(dx, dz)
      if (l < 1e-6) continue
      const nx = -dz/l*half, nz = dx/l*half
      const ya = groundY(a[0], a[1], scale) + y, yc = groundY(c[0], c[1], scale) + y
      b.quad([a[0]-nx,ya,a[1]-nz], [c[0]-nx,yc,c[1]-nz], [c[0]+nx,yc,c[1]+nz], [a[0]+nx,ya,a[1]+nz], color, [0,1,0])
    }
    // Round joints so polylines do not show wedge gaps.
    for (const p of pts) for (let k = 0; k < 6; k++) {
      const a0 = k/6*Math.PI*2, a1 = (k+1)/6*Math.PI*2, yy = groundY(p[0], p[1], scale) + y
      b.tri([p[0],yy,p[1]], [p[0]+Math.cos(a0)*half,yy,p[1]+Math.sin(a0)*half], [p[0]+Math.cos(a1)*half,yy,p[1]+Math.sin(a1)*half], color, [0,1,0])
    }
  }
  return b.build()
}

function addTree(b: MeshBatch, x: number, z: number, scale: number, tone: number, base = 0) {
  const canopy = tone > .66 ? '#4f9a73' : tone > .33 ? '#5aa57a' : '#3f9074'
  b.cylinder(x, z, .28*scale, base, base + 2.6*scale, '#7a5c3e', 6, .22*scale)
  b.dome(x, z, base + 2.2*scale, 2.9*scale, canopy, 3, 8, 3.4*scale)
  b.dome(x + .8*scale, z + .4*scale, base + 3.6*scale, 1.9*scale, canopy, 2, 7, 2.2*scale)
}

/** Individually mapped trees plus illustrative planting inside mapped gardens and parks. */
export function buildTrees(buildingRings: P2[][], terrainScale = 1) {
  const b = new MeshBatch()
  let mapped = 0, planted = 0
  for (const t of campusMap.trees) {
    const [x, z] = toMetres(t.coordinates as Point2)
    addTree(b, x, z, 1.1 + hashOf(String(t.id))*.5, hashOf(String(t.id)+'t'), groundY(x, z, terrainScale))
    mapped++
  }
  const blocked = (p: P2) => buildingRings.some(r => pointInPolygon(p, r))
  for (const s of campusMap.surfaces) {
    if (!lawnTypes.test(s.type)) continue
    for (const ring of s.rings.filter(r => r.role === 'outer')) {
      const pts = (ring.coordinates as Point2[]).map(toMetres)
      const xs = pts.map(p => p[0]), zs = pts.map(p => p[1])
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs)
      const step = 15
      for (let x = x0 + step/2; x < x1; x += step) for (let z = z0 + step/2; z < z1; z += step) {
        const h = hashOf(`${s.id}:${Math.round(x)}:${Math.round(z)}`)
        if (h > .42) continue
        const p: P2 = [x + (h-.2)*8, z + (h-.2)*6]
        if (!pointInPolygon(p, pts) || blocked(p)) continue
        addTree(b, p[0], p[1], .9 + h*1.2, hashOf(`${x}${z}`), groundY(p[0], p[1], terrainScale))
        planted++
        if (planted > 700) break
      }
    }
  }
  // Avenue planting along main roads (illustrative: positions are not mapped trees).
  let side = 1
  for (const r of campusMap.roads) {
    if (!/residential|tertiary|unclassified/.test(r.type)) continue
    const pts = (r.coordinates as Point2[]).map(toMetres), half = roadWidth(r.type, r.width)/2 + 3.4
    let carry = 12
    for (let i = 0; i < pts.length - 1 && planted < 1100; i++) {
      const a = pts[i], c = pts[i+1], dx = c[0]-a[0], dz = c[1]-a[1], l = Math.hypot(dx, dz)
      if (l < 1e-6) continue
      for (let d = carry; d < l; d += 22) {
        const t = d/l, x = a[0] + dx*t - dz/l*half*side, z = a[1] + dz*t + dx/l*half*side
        side = -side
        const h = hashOf(`${r.id}:${Math.round(d)}:${i}`)
        if (h > .72 || blocked([x, z]) || !pointInPolygon([x, z], boundaryMetres)) continue
        addTree(b, x, z, 1 + h*.9, hashOf(`${x}|${z}`), groundY(x, z, terrainScale))
        planted++
      }
      carry = ((carry - l) % 22 + 22) % 22
    }
  }
  return { geometry: b.build(), mapped, planted }
}
