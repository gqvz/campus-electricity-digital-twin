import * as THREE from 'three'
import { MeshBatch } from './batch'
import { campusBoundary, geographicToScene, metersPerSceneUnit, pointInPolygon } from '../buildingGeometry'
import type { Point2 } from '../buildingGeometry'
import { campusMap, mappedSources } from '../campusData'
import { hashOf } from './styles'

type P2 = [number, number]
const toMetres = (p: Point2): P2 => { const s = geographicToScene(p); return [s[0]*metersPerSceneUnit, s[1]*metersPerSceneUnit] }

export const boundaryMetres: P2[] = campusBoundary.map(p => [p[0]*metersPerSceneUnit, p[1]*metersPerSceneUnit])

function triangulate(outer: P2[], holes: P2[][] = []) {
  const contour = outer.map(p => new THREE.Vector2(p[0], p[1]))
  const holeV = holes.map(h => h.map(p => new THREE.Vector2(p[0], p[1])))
  const faces = THREE.ShapeUtils.triangulateShape(contour, holeV)
  return { pts: [...contour, ...holeV.flat()].map(v => [v.x, v.y] as P2), faces }
}

export function campusBounds() {
  const xs = boundaryMetres.map(p => p[0]), zs = boundaryMetres.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs)
  return { minX, maxX, minZ, maxZ, cx: (minX+maxX)/2, cz: (minZ+maxZ)/2, w: maxX-minX, d: maxZ-minZ }
}

export const groundColors = { ground: '#e9d9af', side: '#cfbd8d' }

export function buildGround() {
  const b = new MeshBatch()
  const { pts, faces } = triangulate(boundaryMetres)
  b.flat(pts, faces, 0, groundColors.ground)
  const depth = 6
  boundaryMetres.forEach((a, i) => {
    const c = boundaryMetres[(i+1) % boundaryMetres.length]
    b.quad([a[0],-depth,a[1]], [c[0],-depth,c[1]], [c[0],0,c[1]], [a[0],0,a[1]], groundColors.side)
  })
  // Reverse-wound duplicate so the skirt reads from either side.
  boundaryMetres.forEach((a, i) => {
    const c = boundaryMetres[(i+1) % boundaryMetres.length]
    b.quad([a[0],0,a[1]], [c[0],0,c[1]], [c[0],-depth,c[1]], [a[0],-depth,a[1]], groundColors.side)
  })
  return b.build()
}

const surfaceStyle = (type: string): { color: string; y: number } => {
  if (/swimming_pool|water/.test(type)) return { color: '#8bbdd6', y: .05 }
  if (/track/.test(type)) return { color: '#c9795a', y: .06 }
  if (/pitch|stadium|sports/.test(type)) return { color: '#a9c88f', y: .07 }
  if (/bleacher|seating/.test(type)) return { color: '#d7cfb8', y: .08 }
  if (/park/.test(type)) return { color: '#a7c288', y: .04 }
  if (/garden/.test(type)) return { color: '#b9cc9b', y: .04 }
  if (/education|residential/.test(type)) return { color: '#e4d8b0', y: .03 }
  return { color: '#b9cc9b', y: .04 }
}

export const lawnTypes = /garden|park/

export function buildSurfaces() {
  const b = new MeshBatch()
  for (const s of campusMap.surfaces) {
    const rings = s.rings.map(r => ({ role: r.role, points: (r.coordinates as Point2[]).map(toMetres) }))
    const outers = rings.filter(r => r.role === 'outer'), inners = rings.filter(r => r.role === 'inner')
    const { color, y } = surfaceStyle(s.type)
    for (const o of outers) {
      const holes = inners.filter(h => pointInPolygon(h.points[0], o.points)).map(h => h.points)
      const { pts, faces } = triangulate(o.points, holes)
      b.flat(pts, faces, y, color)
      // Pitches and tracks get a white boundary line.
      if (/pitch|track/.test(s.type)) {
        o.points.forEach((a, i) => {
          const c = o.points[(i+1) % o.points.length], dx = c[0]-a[0], dz = c[1]-a[1], l = Math.hypot(dx, dz) || 1
          const nx = -dz/l*.35, nz = dx/l*.35
          b.quad([a[0]-nx,y+.02,a[1]-nz], [c[0]-nx,y+.02,c[1]-nz], [c[0]+nx,y+.02,c[1]+nz], [a[0]+nx,y+.02,a[1]+nz], '#fffaf0', [0,1,0])
        })
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
      b.flat(tp, faces, .045, lawn)
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

export function buildRoads() {
  const b = new MeshBatch()
  for (const r of campusMap.roads) {
    const pts = (r.coordinates as Point2[]).map(toMetres), w = roadWidth(r.type, r.width), half = w/2
    const walk = /footway|path|cycleway|pedestrian|steps/.test(r.type)
    const color = walk ? '#fffdf2' : r.type === 'construction' ? '#e0d6bd' : '#f7efd9', y = walk ? .11 : .09
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], c = pts[i+1], dx = c[0]-a[0], dz = c[1]-a[1], l = Math.hypot(dx, dz)
      if (l < 1e-6) continue
      const nx = -dz/l*half, nz = dx/l*half
      b.quad([a[0]-nx,y,a[1]-nz], [c[0]-nx,y,c[1]-nz], [c[0]+nx,y,c[1]+nz], [a[0]+nx,y,a[1]+nz], color, [0,1,0])
    }
    // Round joints so polylines do not show wedge gaps.
    for (const p of pts) for (let k = 0; k < 6; k++) {
      const a0 = k/6*Math.PI*2, a1 = (k+1)/6*Math.PI*2
      b.tri([p[0],y,p[1]], [p[0]+Math.cos(a0)*half,y,p[1]+Math.sin(a0)*half], [p[0]+Math.cos(a1)*half,y,p[1]+Math.sin(a1)*half], color, [0,1,0])
    }
  }
  return b.build()
}

function addTree(b: MeshBatch, x: number, z: number, scale: number, tone: number) {
  const canopy = tone > .66 ? '#4f9a73' : tone > .33 ? '#5aa57a' : '#3f9074'
  b.cylinder(x, z, .28*scale, 0, 2.6*scale, '#7a5c3e', 6, .22*scale)
  b.dome(x, z, 2.2*scale, 2.9*scale, canopy, 3, 8, 3.4*scale)
  b.dome(x + .8*scale, z + .4*scale, 3.6*scale, 1.9*scale, canopy, 2, 7, 2.2*scale)
}

/** Individually mapped trees plus illustrative planting inside mapped gardens and parks. */
export function buildTrees(buildingRings: P2[][]) {
  const b = new MeshBatch()
  let mapped = 0, planted = 0
  for (const t of campusMap.trees) {
    const [x, z] = toMetres(t.coordinates as Point2)
    addTree(b, x, z, 1.1 + hashOf(String(t.id))*.5, hashOf(String(t.id)+'t'))
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
        addTree(b, p[0], p[1], .9 + h*1.2, hashOf(`${x}${z}`))
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
        addTree(b, x, z, 1 + h*.9, hashOf(`${x}|${z}`))
        planted++
      }
      carry = ((carry - l) % 22 + 22) % 22
    }
  }
  return { geometry: b.build(), mapped, planted }
}
