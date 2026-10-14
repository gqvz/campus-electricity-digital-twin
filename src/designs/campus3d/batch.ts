import * as THREE from 'three'

// Accumulates coloured triangles so a whole building becomes one draw call per
// material. Coordinates are metres: x east, y up, z south.
export type V3 = [number, number, number]

const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3()
const colorCache = new Map<string, THREE.Color>()
export function colorOf(hex: string) {
  let c = colorCache.get(hex)
  if (!c) { c = new THREE.Color(hex); colorCache.set(hex, c) }
  return c
}

export class MeshBatch {
  positions: number[] = []
  normals: number[] = []
  colors: number[] = []
  indices: number[] = []

  private vertex(p: V3, n: V3, c: THREE.Color) {
    const i = this.positions.length / 3
    this.positions.push(p[0], p[1], p[2]); this.normals.push(n[0], n[1], n[2]); this.colors.push(c.r, c.g, c.b)
    return i
  }

  /** Quad a-b-c-d, wound counter-clockwise when seen from `outward` (or by its own winding). */
  quad(a: V3, b: V3, c: V3, d: V3, color: string, outward?: V3) {
    tmpA.set(b[0]-a[0], b[1]-a[1], b[2]-a[2]); tmpB.set(c[0]-a[0], c[1]-a[1], c[2]-a[2])
    tmpC.crossVectors(tmpA, tmpB)
    if (tmpC.lengthSq() < 1e-12) { tmpA.set(c[0]-a[0], c[1]-a[1], c[2]-a[2]); tmpB.set(d[0]-a[0], d[1]-a[1], d[2]-a[2]); tmpC.crossVectors(tmpA, tmpB) }
    if (tmpC.lengthSq() < 1e-12) return
    if (outward && tmpC.x*outward[0] + tmpC.y*outward[1] + tmpC.z*outward[2] < 0) { [a, c] = [c, a]; tmpC.negate() }
    tmpC.normalize()
    const n: V3 = [tmpC.x, tmpC.y, tmpC.z], col = colorOf(color)
    const i = this.vertex(a, n, col); this.vertex(b, n, col); this.vertex(c, n, col); this.vertex(d, n, col)
    this.indices.push(i, i+1, i+2, i, i+2, i+3)
  }

  tri(a: V3, b: V3, c: V3, color: string, outward?: V3) {
    tmpA.set(b[0]-a[0], b[1]-a[1], b[2]-a[2]); tmpB.set(c[0]-a[0], c[1]-a[1], c[2]-a[2])
    tmpC.crossVectors(tmpA, tmpB)
    if (tmpC.lengthSq() < 1e-12) return
    if (outward && tmpC.x*outward[0] + tmpC.y*outward[1] + tmpC.z*outward[2] < 0) { [b, c] = [c, b]; tmpC.negate() }
    tmpC.normalize()
    const n: V3 = [tmpC.x, tmpC.y, tmpC.z], col = colorOf(color)
    const i = this.vertex(a, n, col); this.vertex(b, n, col); this.vertex(c, n, col)
    this.indices.push(i, i+1, i+2)
  }

  /** Axis-aligned box. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: string, topColor = color) {
    this.quad([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1], topColor, [0,1,0])
    this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1], color, [0,0,1])
    this.quad([x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0], color, [0,0,-1])
    this.quad([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0], color, [1,0,0])
    this.quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0], color, [-1,0,0])
  }

  /** Vertical cylinder with a flat cap. */
  cylinder(cx: number, cz: number, r: number, y0: number, y1: number, color: string, segments = 10, rTop = r, capColor = color) {
    for (let i = 0; i < segments; i++) {
      const a0 = i/segments*Math.PI*2, a1 = (i+1)/segments*Math.PI*2
      const p = (a: number, rr: number, y: number): V3 => [cx + Math.cos(a)*rr, y, cz + Math.sin(a)*rr]
      const mid = (a0+a1)/2
      this.quad(p(a0,r,y0), p(a1,r,y0), p(a1,rTop,y1), p(a0,rTop,y1), color, [Math.cos(mid), 0, Math.sin(mid)])
      if (rTop > 0.001) this.tri([cx,y1,cz], p(a0,rTop,y1), p(a1,rTop,y1), capColor, [0,1,0])
    }
  }

  /** Spherical cap / hemisphere dome. */
  dome(cx: number, cz: number, y: number, r: number, color: string, rings = 6, segments = 14, height = r) {
    for (let k = 0; k < rings; k++) {
      const t0 = k/rings*Math.PI/2, t1 = (k+1)/rings*Math.PI/2
      const r0 = Math.cos(t0)*r, r1 = Math.cos(t1)*r, y0 = y + Math.sin(t0)*height, y1 = y + Math.sin(t1)*height
      for (let i = 0; i < segments; i++) {
        const a0 = i/segments*Math.PI*2, a1 = (i+1)/segments*Math.PI*2, mid = (a0+a1)/2
        const n: V3 = [Math.cos(mid)*Math.cos((t0+t1)/2), Math.sin((t0+t1)/2), Math.sin(mid)*Math.cos((t0+t1)/2)]
        if (k === rings-1) this.tri([cx+Math.cos(a0)*r0,y0,cz+Math.sin(a0)*r0],[cx+Math.cos(a1)*r0,y0,cz+Math.sin(a1)*r0],[cx,y1,cz], color, n)
        else this.quad([cx+Math.cos(a0)*r0,y0,cz+Math.sin(a0)*r0],[cx+Math.cos(a1)*r0,y0,cz+Math.sin(a1)*r0],[cx+Math.cos(a1)*r1,y1,cz+Math.sin(a1)*r1],[cx+Math.cos(a0)*r1,y1,cz+Math.sin(a0)*r1], color, n)
      }
    }
  }

  /** Flat horizontal polygon (already triangulated indices into `points`). */
  flat(points: [number, number][], faces: number[][], y: number | ((x: number, z: number) => number), color: string) {
    const h = (x: number, z: number) => typeof y === 'number' ? y : y(x, z)
    for (const [a, b, c] of faces) {
      const A = points[a], B = points[b], C = points[c]
      this.tri([A[0],h(A[0],A[1]),A[1]],[B[0],h(B[0],B[1]),B[1]],[C[0],h(C[0],C[1]),C[1]], color, [0,1,0])
    }
  }

  get empty() { return this.indices.length === 0 }

  build() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3))
    g.setIndex(this.indices)
    g.computeBoundingSphere(); g.computeBoundingBox()
    return g
  }
}
