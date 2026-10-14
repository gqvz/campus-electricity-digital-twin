import * as THREE from 'three'
import { MeshBatch } from './batch'
import type { V3 } from './batch'
import { distanceToRing, footprintFor, footprintSources, metersPerSceneUnit, outlineEdges, pointInPolygon } from '../buildingGeometry'
import type { CampusBuilding } from '../fixtures'
import { hashOf, isDetailed, styleFor } from './styles'
import type { Style } from './styles'

// Procedural architectural models. Plan outlines are the sourced OSM rings;
// everything vertical (storeys, bays, columns, domes) is a schematic study
// derived from photographs, never a surveyed elevation.
type P2 = [number, number]
export type Ring = { role: string; points: P2[] }
export type Edge = { a: P2; b: P2; len: number; T: P2; N: P2; role: string }
export type ModelSpec = {
  id: string; rings: Ring[]; height: number; floors: number; style: Style
  detailed: boolean; slope?: number
}
export type BuildingModel = { solid: THREE.BufferGeometry; glass: THREE.BufferGeometry; topY: number; footprint: Ring[] }

export const THOMASON_ID = 'osm-relation-8255183'
// Dome, portico and tower anchors for the Thomason Building, in campus metres
// (x east, z south). Taken from the OSM courtyard footprint and Street View.
// The front faces north, toward the Main Building lawns and Thomason Marg; the tower stands behind it.
export const thomasonAnchors = { dome: [154, -4] as P2, portico: [154, -20] as P2, tower: [129, 3] as P2 }
const THOMASON_FRONT = -1 // -1 = toward -z (north)

export function ringsInMetres(b: CampusBuilding): Ring[] {
  return footprintFor(b).map(r => ({ role: r.role, points: r.points.map(p => [p[0]*metersPerSceneUnit, p[1]*metersPerSceneUnit] as P2) }))
}

export function edgesOf(b: CampusBuilding): Edge[] {
  return outlineEdges(footprintFor(b)).map(e => ({
    a: [e.a[0]*metersPerSceneUnit, e.a[1]*metersPerSceneUnit], b: [e.b[0]*metersPerSceneUnit, e.b[1]*metersPerSceneUnit],
    len: e.length*metersPerSceneUnit, T: [(e.b[0]-e.a[0])/e.length, (e.b[1]-e.a[1])/e.length], N: e.normal, role: e.role,
  }))
}

const P = (e: Edge, s: number, y: number, o: number): V3 => [e.a[0]+e.T[0]*s+e.N[0]*o, y, e.a[1]+e.T[1]*s+e.N[1]*o]
const outward = (e: Edge): V3 => [e.N[0], 0, e.N[1]]

function edgeBox(b: MeshBatch, e: Edge, s0: number, s1: number, y0: number, y1: number, o0: number, o1: number, color: string, top = color) {
  if (s1 - s0 < 1e-3 || y1 - y0 < 1e-3) return
  const n = outward(e), t: V3 = [e.T[0], 0, e.T[1]]
  b.quad(P(e,s0,y0,o1), P(e,s1,y0,o1), P(e,s1,y1,o1), P(e,s0,y1,o1), color, n)
  b.quad(P(e,s0,y1,o0), P(e,s1,y1,o0), P(e,s1,y1,o1), P(e,s0,y1,o1), top, [0,1,0])
  b.quad(P(e,s0,y0,o0), P(e,s0,y0,o1), P(e,s0,y1,o1), P(e,s0,y1,o0), color, [-t[0],0,-t[2]])
  b.quad(P(e,s1,y0,o0), P(e,s1,y0,o1), P(e,s1,y1,o1), P(e,s1,y1,o0), color, t)
  if (o0 < -1e-3) b.quad(P(e,s0,y0,o0), P(e,s1,y0,o0), P(e,s1,y1,o0), P(e,s0,y1,o0), color, [-n[0],0,-n[2]])
}

function roofTriangles(rings: Ring[]) {
  const inners = rings.filter(r => r.role === 'inner')
  return rings.filter(r => r.role === 'outer').map(o => {
    const holes = inners.filter(h => pointInPolygon(h.points[0], o.points))
    const contour = o.points.map(p => new THREE.Vector2(p[0], p[1]))
    const holeV = holes.map(h => h.points.map(p => new THREE.Vector2(p[0], p[1])))
    const faces = THREE.ShapeUtils.triangulateShape(contour, holeV)
    return { pts: [...contour, ...holeV.flat()].map(v => [v.x, v.y] as P2), faces }
  })
}

type Ctx = { solid: MeshBatch; glass: MeshBatch; spec: ModelSpec; edges: Edge[]; top: (x: number, z: number) => number }

function windowsOn(c: Ctx, e: Edge, y0: number, y1: number, floors: number, bays: number) {
  const st = c.spec.style, floorH = (y1 - y0) / floors, bw = e.len / bays, n = outward(e)
  for (let f = 0; f < floors; f++) for (let i = 0; i < bays; i++) {
    const centre = (i + .5)*bw, slit = st.id === 'sandstone' && i % 3 !== 1, w = bw*(slit ? .16 : st.win), s0 = centre - w/2, s1 = centre + w/2
    const yb = y0 + f*floorH + floorH*st.sill, yt = y0 + f*floorH + floorH*st.head
    if (st.id === 'colonial') {
      const spring = yt - w/2
      c.glass.quad(P(e,s0,yb,.05), P(e,s1,yb,.05), P(e,s1,spring,.05), P(e,s0,spring,.05), st.glass, n)
      for (let k = 0; k < 6; k++) {
        const a0 = Math.PI - k/6*Math.PI, a1 = Math.PI - (k+1)/6*Math.PI
        c.glass.tri(P(e,centre,spring,.05), P(e,centre+Math.cos(a0)*w/2,spring+Math.sin(a0)*w/2,.05), P(e,centre+Math.cos(a1)*w/2,spring+Math.sin(a1)*w/2,.05), st.glass, n)
      }
      if (c.spec.detailed) {
        edgeBox(c.solid, e, s0-.22, s0, yb-.1, spring, 0, .22, st.trim)
        edgeBox(c.solid, e, s1, s1+.22, yb-.1, spring, 0, .22, st.trim)
        edgeBox(c.solid, e, s0-.3, s1+.3, yb-.28, yb, 0, .3, st.trim)
        edgeBox(c.solid, e, s0-.22, s1+.22, yt+.1, yt+.35, 0, .26, st.trim)
        if (f === floors-1) edgeBox(c.solid, e, centre-w/2-.1, centre+w/2+.1, yt+.35, yt+.62, 0, .2, st.trim)
      }
    } else {
      c.glass.quad(P(e,s0,yb,.05), P(e,s1,yb,.05), P(e,s1,yt,.05), P(e,s0,yt,.05), st.glass, n)
      if (c.spec.detailed) {
        const t = .14
        edgeBox(c.solid, e, s0-t, s1+t, yt, yt+t, 0, .3, st.trim)
        edgeBox(c.solid, e, s0-t, s1+t, yb-t, yb, 0, .38, st.trim)
        edgeBox(c.solid, e, s0-t, s0, yb, yt, 0, .3, st.trim)
        edgeBox(c.solid, e, s1, s1+t, yb, yt, 0, .3, st.trim)
        if (st.id === 'grid') edgeBox(c.solid, e, centre-.04, centre+.04, yb, yt, 0, .18, st.trim)
      }
    }
  }
}

function decorateEdge(c: Ctx, e: Edge, y0: number, y1: number, floors: number) {
  const st = c.spec.style, floorH = (y1 - y0) / floors
  const bays = Math.max(1, Math.round(e.len / st.bay)), bw = e.len / bays, g = c.solid
  windowsOn(c, e, y0, y1, floors, bays)
  edgeBox(g, e, 0, e.len, y0, y0 + .7, 0, .09, st.base)
  for (let f = 1; f < floors; f++) edgeBox(g, e, 0, e.len, y0+f*floorH-.08, y0+f*floorH+.08, 0, .12, st.trim)
  const parapet = !c.spec.slope && st.id !== 'sandstone'
  if (parapet) edgeBox(g, e, 0, e.len, y1, y1 + (st.id === 'colonial' ? 1.1 : .75), -.25, .02, st.trim)

  if (st.id === 'colonial') {
    for (let i = 0; i <= bays; i++) edgeBox(g, e, Math.max(0, i*bw-.32), Math.min(e.len, i*bw+.32), y0, y1, 0, .36, st.trim)
    edgeBox(g, e, 0, e.len, y1-.95, y1+.12, 0, .85, st.trim)
    edgeBox(g, e, 0, e.len, y0+floorH-.2, y0+floorH+.2, 0, .3, st.trim)
  } else if (st.id === 'sandstone') {
    for (let i = 0; i <= bays; i++) edgeBox(g, e, Math.max(0, i*bw-.28), Math.min(e.len, i*bw+.28), y0, y1, 0, .6, st.trim)
    for (let f = 1; f <= floors; f++) edgeBox(g, e, 0, e.len, y0+f*floorH-.35, y0+f*floorH-.05, 0, .35, st.base)
    edgeBox(g, e, 0, e.len, y1, y1 + .6, -.1, 1.15, st.trim, st.roof)
  } else if (st.id === 'grid') {
    for (let i = 0; i <= bays; i++) edgeBox(g, e, Math.max(0, i*bw-.2), Math.min(e.len, i*bw+.2), y0, y1, 0, .5, st.accent)
    for (let f = 1; f <= floors; f++) edgeBox(g, e, 0, e.len, y0+f*floorH-.28, y0+f*floorH+.12, 0, .62, st.trim)
  } else if (st.id === 'hostel') {
    for (let f = 1; f < floors; f++) {
      const yf = y0 + f*floorH
      edgeBox(g, e, 0, e.len, yf-.2, yf+.02, 0, 1.3, st.trim)
      edgeBox(g, e, 0, e.len, yf+.02, yf+.95, 1.18, 1.3, st.trim)
    }
    if (c.spec.detailed) for (let f = 0; f < floors; f++) for (let i = 0; i < bays; i++) {
      const s = (i + .5)*bw + bw*.3, yf = y0 + f*floorH, col = (f + i) % 2 ? st.accent : st.accent2
      c.glass.quad(P(e,s-.45,yf+.05,.07), P(e,s+.45,yf+.05,.07), P(e,s+.45,yf+2.15,.07), P(e,s-.45,yf+2.15,.07), col, outward(e))
    }
  } else if (st.id === 'sandblock') {
    for (let i = 0; i <= bays; i++) edgeBox(g, e, Math.max(0, i*bw-.2), Math.min(e.len, i*bw+.2), y0, y1, 0, .5, st.trim)
    edgeBox(g, e, 0, e.len, y1, y1 + .5, 0, .8, st.trim, st.roof)
  }
}

function addTank(g: MeshBatch, x: number, z: number, y: number, trim: string) {
  g.cylinder(x, z, .9, y + .9, y + 2.3, '#cfd5d6', 10, .9, '#9aa6aa')
  g.box(x - 1, y, z - 1, x + 1, y + .9, z + 1, trim)
}

function addRoofClutter(c: Ctx, y1: number) {
  const outers = c.spec.rings.filter(r => r.role === 'outer'), inners = c.spec.rings.filter(r => r.role === 'inner')
  const area = outers.reduce((s, r) => s + Math.abs(areaOf(r.points)), 0)
  if (area < 120) return
  const pts = outers.flatMap(r => r.points)
  const x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0]))
  const z0 = Math.min(...pts.map(p => p[1])), z1 = Math.max(...pts.map(p => p[1]))
  const st = c.spec.style, step = area > 3000 ? 16 : 11
  let placed = 0
  for (let x = x0 + step/2; x < x1 && placed < 16; x += step) for (let z = z0 + step/2; z < z1 && placed < 16; z += step) {
    const h = hashOf(`${c.spec.id}:${Math.round(x)}:${Math.round(z)}`)
    if (h > .45) continue
    const p: P2 = [x + (h-.2)*5, z + (h-.2)*4]
    if (!outers.some(r => pointInPolygon(p, r.points)) || inners.some(r => pointInPolygon(p, r.points))) continue
    if (outers.some(r => distanceToRing(p, r.points) < 3.2) || inners.some(r => distanceToRing(p, r.points) < 3.2)) continue
    const kind = h*100 % 1
    if (kind < .4) addTank(c.solid, p[0], p[1], y1, st.trim)
    else if (kind < .7) c.solid.box(p[0]-1.7, y1, p[1]-1.4, p[0]+1.7, y1+2.7, p[1]+1.4, st.wall, st.trim)
    else { c.solid.box(p[0]-1.1, y1, p[1]-.7, p[0]+1.1, y1+1.1, p[1]+.7, '#aeb4b6', '#c9cfd1'); c.solid.box(p[0]+1.5, y1, p[1]-.6, p[0]+2.9, y1+.9, p[1]+.6, '#aeb4b6', '#c9cfd1') }
    placed++
  }
}

function areaOf(points: P2[]) {
  return points.reduce((s, a, i) => { const b = points[(i+1) % points.length]; return s + a[0]*b[1] - b[0]*a[1] }, 0) / 2
}

function longestEdge(edges: Edge[]) {
  return edges.filter(e => e.role === 'outer').reduce((m, e) => e.len > m.len ? e : m, edges[0])
}

function addThomasonLandmarks(c: Ctx, y1: number) {
  const g = c.solid, st = c.spec.style, a = thomasonAnchors, white = st.trim
  // Portico: six full-height columns carrying an entablature and pediment.
  const [px, pz] = a.portico, w = 24, f = THOMASON_FRONT, colH = y1 - .5
  const Z = (d: number) => pz + f*d, front = Z(3.2)
  g.box(px-w/2-2, 0, Z(-1), px+w/2+2, .45, Z(6.4), '#d8d1bd', white)
  g.box(px-w/2-1, .45, Z(-.5), px+w/2+1, .9, Z(5.2), '#e3dcc8', white)
  for (let i = 0; i < 6; i++) {
    const x = px - w/2 + 1.6 + i*(w-3.2)/5
    g.box(x-.75, .9, front-.75, x+.75, 1.6, front+.75, white)
    g.cylinder(x, front, .6, 1.6, colH, white, 12, .52)
    g.box(x-.8, colH, front-.8, x+.8, colH+.45, front+.8, white)
  }
  const outer = Z(4.25), inner = Z(-.2)
  g.box(px-w/2, colH+.45, Math.min(inner, outer), px+w/2, colH+1.5, Math.max(inner, outer), white)
  g.tri([px-w/2-.4, colH+1.5, outer], [px+w/2+.4, colH+1.5, outer], [px, colH+4.6, outer], white, [0,0,f])
  g.tri([px-w/2-.4, colH+1.5, inner], [px+w/2+.4, colH+1.5, inner], [px, colH+4.6, inner], st.wall, [0,0,-f])
  g.quad([px-w/2-.4, colH+1.5, inner], [px-w/2-.4, colH+1.5, outer], [px, colH+4.6, outer], [px, colH+4.6, inner], '#d9d0b8', [-1,1,0])
  g.quad([px+w/2+.4, colH+1.5, outer], [px+w/2+.4, colH+1.5, inner], [px, colH+4.6, inner], [px, colH+4.6, outer], '#cfc6ac', [1,1,0])
  // Central drum, clock faces and dome.
  const [dx, dz] = a.dome, base = y1 + 1.2
  g.cylinder(dx, dz, 6.4, base-1.2, base+3.6, st.wall, 28, 6.4, st.trim)
  g.cylinder(dx, dz, 6.9, base+3.4, base+4.1, white, 28)
  g.dome(dx, dz, base+4.1, 6.0, '#f4f0e2', 9, 28, 6.6)
  for (const [ox, oz] of [[6.5, 0], [-6.5, 0], [0, 6.5], [0, -6.5]] as P2[]) {
    const horizontal = oz === 0
    g.box(dx+ox-(horizontal?.12:1.1), base+.9, dz+oz-(horizontal?1.1:.12), dx+ox+(horizontal?.12:1.1), base+3.1, dz+oz+(horizontal?1.1:.12), '#f9f7ef')
    g.box(dx+ox-(horizontal?.16:.7), base+1.4, dz+oz-(horizontal?.7:.16), dx+ox+(horizontal?.16:.7), base+2.6, dz+oz+(horizontal?.7:.16), '#263e55')
  }
  const lantern = base + 4.1 + 6.6
  g.cylinder(dx, dz, 1.3, lantern-.2, lantern+2.2, white, 10)
  g.dome(dx, dz, lantern+2.2, 1.5, '#f4f0e2', 3, 10, 1.4)
  g.cylinder(dx, dz, .1, lantern+3.6, lantern+5.2, '#7a6a4a', 5)
  // Detached square clock/water tower rising behind the dome (on the far side from the front).
  const [tx, tz] = a.tower, th = y1 + 16
  g.box(tx-3.2, 0, tz-3.2, tx+3.2, th, tz+3.2, st.wall, st.trim)
  for (let k = 0; k < 4; k++) {
    const y = y1 + 2 + k*3.4
    g.box(tx-3.35, y, tz-.3, tx+3.35, y+2, tz+.3, '#495f73')
    g.box(tx-.3, y, tz-3.35, tx+.3, y+2, tz+3.35, '#495f73')
  }
  g.box(tx-3.9, th-.2, tz-3.9, tx+3.9, th+1.4, tz+3.9, white, white)
  g.cylinder(tx, tz, 2.6, th+1.4, th+4.4, '#e4dcc4', 4, 0.2, white)
}

function addLibraryLandmarks(c: Ctx, y1: number, edges: Edge[]) {
  const e = longestEdge(edges), g = c.solid, st = c.spec.style
  // Stepped sandstone plaza and planters in front of the longest frontage.
  for (let k = 0; k < 4; k++) edgeBox(g, e, e.len*.12, e.len*.88, 0, .2+ (3-k)*.0 + .15, k*1.0+.1, k*1.0+1.1, k % 2 ? '#d7a58a' : '#e0b49a', '#e8c2a8')
  edgeBox(g, e, e.len*.05, e.len*.12, 0, .8, 1, 3.6, '#a8644b', '#8f7f60')
  edgeBox(g, e, e.len*.88, e.len*.95, 0, .8, 1, 3.6, '#a8644b', '#8f7f60')
  // Shallow roof dome over the reading halls (seen above the roofline in street-level photos).
  const outer = c.spec.rings.find(r => r.role === 'outer')!
  const xs = outer.points.map(p => p[0]), zs = outer.points.map(p => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs))/2, cz = (Math.min(...zs) + Math.max(...zs))/2
  g.cylinder(cx, cz, 7.5, y1, y1+1.2, st.wall, 18, 7.5, st.trim)
  g.dome(cx, cz, y1+1.2, 7, st.trim, 4, 18, 2.4)
}

function addSlatScreens(c: Ctx, e: Edge, y0: number, y1: number) {
  if (e.len < 5) return
  const n = Math.max(2, Math.round(e.len / 2.4)), w = e.len / n, hh = (y1 - y0 - 1.6) / 3
  for (let row = 0; row < 3; row++) for (let i = 0; i < n; i++) {
    const s0 = i*w + .15, s1 = (i+1)*w - .15, yb = y0 + .8 + row*hh
    c.solid.quad(P(e,s0,yb,.2), P(e,s1,yb+hh*.78,.2), P(e,s1,yb+hh*.78+.28,.2), P(e,s0,yb+.28,.2), c.spec.style.accent2, outward(e))
  }
}

function addMacFrames(c: Ctx, e: Edge, y1: number) {
  const post = '#b9b2a0', n = Math.max(1, Math.round(e.len / 4))
  for (let i = 0; i <= n; i++) {
    const s = Math.min(e.len - .15, Math.max(.15, i*e.len/n))
    edgeBox(c.solid, e, s-.15, s+.15, y1, y1+2.6, -.3, .05, post)
  }
  edgeBox(c.solid, e, 0, e.len, y1+2.45, y1+2.75, -.3, .05, post)
}

export function buildModel(spec: ModelSpec, edges: Edge[], extra?: 'thomason' | 'library' | 'sac' | 'mac' | 'lhc'): BuildingModel {
  const solid = new MeshBatch(), glass = new MeshBatch()
  const st = spec.style, y0 = 0
  const xs = spec.rings.flatMap(r => r.points.map(p => p[1])), zMin = Math.min(...xs), zMax = Math.max(...xs)
  const top = (_x: number, z: number) => spec.height + (spec.slope ? (zMax - z)/Math.max(1, zMax - zMin)*spec.slope : 0)
  const c: Ctx = { solid, glass, spec, edges, top }
  // Walls
  for (const e of edges) {
    const ta = top(e.a[0], e.a[1]), tb = top(e.b[0], e.b[1])
    solid.quad([e.a[0],y0,e.a[1]], [e.b[0],y0,e.b[1]], [e.b[0],tb,e.b[1]], [e.a[0],ta,e.a[1]], st.wall, outward(e))
    if (e.len > 1.5) decorateEdge(c, e, y0, spec.height, spec.floors)
  }
  // Roofs (flat or one-way sloped), with courtyards left open.
  for (const { pts, faces } of roofTriangles(spec.rings)) solid.flat(pts, faces, top, st.roof)
  const y1 = spec.height
  if (spec.detailed || extra) {
    const main = longestEdge(edges)
    if (main && main.len > 6) {
      const s = main.len/2
      glass.quad(P(main,s-.9,0,.1), P(main,s+.9,0,.1), P(main,s+.9,2.7,.1), P(main,s-.9,2.7,.1), '#38424a', outward(main))
    }
  }
  if (!extra) addRoofClutter(c, y1)
  if (extra === 'thomason') addThomasonLandmarks(c, y1)
  if (extra === 'library') addLibraryLandmarks(c, y1, edges)
  if (extra === 'sac') for (const e of edges) if (e.role === 'outer') addSlatScreens(c, e, y0, y1)
  if (extra === 'mac') for (const e of edges) if (e.role === 'outer') addMacFrames(c, e, y1)
  if (extra === 'lhc') for (const e of edges) if (e.role === 'outer' && e.len > 10) {
    const n = Math.round(e.len / 1.4)
    for (let i = 0; i < n; i++) edgeBox(solid, e, (i+.5)*e.len/n - .06, (i+.5)*e.len/n + .06, y0 + 1, y1 - .6, 0, .55, st.trim)
  }
  return { solid: solid.build(), glass: glass.build(), topY: y1 + (spec.slope ?? 0), footprint: spec.rings }
}

const modelCache = new Map<string, BuildingModel>()
const extraFor: Record<string, 'thomason' | 'library' | 'sac' | 'mac' | 'lhc'> = { [THOMASON_ID]: 'thomason', mgcl: 'library', sac: 'sac', mac: 'mac', lhc: 'lhc' }

export function modelFor(b: CampusBuilding): BuildingModel {
  let model = modelCache.get(b.id)
  if (!model) {
    const source = footprintSources[b.id]
    const height = b.heightMeters ?? b.floors*3.6
    const floors = Math.max(1, b.floors || Math.round(height/3.4))
    const spec: ModelSpec = { id: b.id, rings: ringsInMetres(b), height, floors, style: styleFor(b, source), detailed: isDetailed(b), slope: b.id === 'sac' ? 2.4 : undefined }
    model = buildModel(spec, edgesOf(b), extraFor[b.id])
    modelCache.set(b.id, model)
  }
  return model
}

/** One storey slab for the exploded floor view. */
export function floorSliceModel(b: CampusBuilding, floor: number): BuildingModel {
  const source = footprintSources[b.id]
  const floorH = (b.heightMeters ?? b.floors*3.6) / b.floors
  const spec: ModelSpec = { id: `${b.id}#${floor}`, rings: ringsInMetres(b), height: floorH - .35, floors: 1, style: styleFor(b, source), detailed: true }
  return buildModel(spec, edgesOf(b))
}

export function clearModelCache() { modelCache.clear() }
