import { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Zap } from 'lucide-react'
import type { CampusTheme } from './theme'
import { campusBuildings, loadFor, number } from './fixtures'
import type { CampusBuilding, Case } from './fixtures'
import { floorSliceModel, modelFor } from './campus3d/buildingModel'
import { buildGround, buildRoads, buildSurfaces, buildTrees, campusBounds } from './campus3d/terrain'

export type SceneHandle = {
  zoomBy: (factor: number) => void
  rotateBy: (degrees: number) => void
  panBy: (right: number, forward: number) => void
  setFocus: (on: boolean) => void
  reset: () => void
}

type Props = {
  direction: CampusTheme; selected: string; onSelect: (id: string) => void; cases?: Case[]; visible?: string[]
  exploded?: boolean; selectedFloor?: number | null; markers?: boolean; focus?: boolean; resetKey?: number
}

const HOME = { azimuth: THREE.MathUtils.degToRad(28), elevation: THREE.MathUtils.degToRad(38) }
const bounds = campusBounds()
const centre = new THREE.Vector3(bounds.cx, 0, bounds.cz)

// ---------------------------------------------------------------- terrain

const Terrain = memo(function Terrain({ buildingRings }: { buildingRings: [number, number][][] }) {
  const ground = useMemo(buildGround, [])
  const surfaces = useMemo(buildSurfaces, [])
  const roads = useMemo(buildRoads, [])
  const trees = useMemo(() => buildTrees(buildingRings).geometry, [buildingRings])
  const flat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), [])
  const none = () => null
  return <group>
    <mesh geometry={ground} material={flat} receiveShadow raycast={none} name="campus-ground" />
    <mesh geometry={surfaces} material={flat} receiveShadow raycast={none} name="campus-surfaces" />
    <mesh geometry={roads} material={flat} receiveShadow raycast={none} name="campus-roads" />
    <mesh geometry={trees} material={flat} castShadow receiveShadow raycast={none} name="campus-trees" />
  </group>
})

// ---------------------------------------------------------------- buildings

const solidMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .92, metalness: 0 })
const glassMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .22, metalness: .15 })
const selectedSolid = solidMaterial.clone(); selectedSolid.emissive = new THREE.Color('#206889'); selectedSolid.emissiveIntensity = .28
const selectedGlass = glassMaterial.clone(); selectedGlass.emissive = new THREE.Color('#206889'); selectedGlass.emissiveIntensity = .3
const dimSolid = solidMaterial.clone(); dimSolid.transparent = true; dimSolid.opacity = .35
const dimGlass = glassMaterial.clone(); dimGlass.transparent = true; dimGlass.opacity = .35

type MeshProps = { b: CampusBuilding; selected: boolean; hovered: boolean; watts: number; exploded: boolean; floor: number | null; accent: string; onSelect: (id: string) => void; onHover: (id: string | null) => void; markers: boolean }

const BuildingMesh = memo(function BuildingMesh({ b, selected, hovered, watts, exploded, floor, accent, onSelect, onHover, markers }: MeshProps) {
  const model = useMemo(() => modelFor(b), [b])
  const separate = exploded && selected && !!b.hero
  const slices = useMemo(() => separate ? Array.from({ length: b.floors }, (_, k) => floorSliceModel(b, k)) : [], [separate, b])
  const floorH = (b.heightMeters ?? b.floors*3.6) / b.floors
  const centreOf = useMemo(() => {
    const pts = model.footprint.flatMap(r => r.points)
    const xs = pts.map(p => p[0]), zs = pts.map(p => p[1])
    return [(Math.min(...xs) + Math.max(...xs))/2, (Math.min(...zs) + Math.max(...zs))/2] as [number, number]
  }, [model])
  const outline = useMemo(() => model.footprint.filter(r => r.role === 'outer').map(r => [...r.points, r.points[0]].map(p => [p[0], .35, p[1]] as [number, number, number])), [model])
  const handlers = {
    onClick: (e: { stopPropagation: () => void; delta: number }) => { e.stopPropagation(); if (e.delta < 6) onSelect(b.id) },
    onPointerOver: (e: { stopPropagation: () => void }) => { e.stopPropagation(); onHover(b.id); document.body.style.cursor = 'pointer' },
    onPointerOut: () => { onHover(null); document.body.style.cursor = '' },
  }
  const solid = selected ? selectedSolid : solidMaterial, glass = selected ? selectedGlass : glassMaterial
  const stackTop = separate ? b.floors*(floorH + 5) : model.topY
  return <group name={`building-${b.id}`} userData={{ buildingId: b.id }}>
    {!separate && <group {...handlers}>
      <mesh geometry={model.solid} material={solid} castShadow receiveShadow />
      <mesh geometry={model.glass} material={glass} castShadow receiveShadow />
    </group>}
    {separate && slices.map((m, k) => {
      const dim = floor !== null && floor !== k
      return <group key={k} position={[0, k*(floorH + 5), 0]} {...handlers}>
        <mesh geometry={m.solid} material={dim ? dimSolid : solid} castShadow />
        <mesh geometry={m.glass} material={dim ? dimGlass : glass} />
      </group>
    })}
    {selected && outline.map((pts, i) => <Line key={i} points={pts} color={accent} lineWidth={3} />)}
    {(selected || hovered) && <Html position={[centreOf[0], stackTop + 8, centreOf[1]]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div className="scene-label3d" data-selected={selected}>{b.short} / {b.auditScope ? `${number(watts)} W` : 'Not audited'}</div>
    </Html>}
    {markers && watts > 0 && <Html position={[centreOf[0], stackTop + 3, centreOf[1]]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
      <div className="scene-marker3d" data-selected={selected} aria-hidden="true"><Zap size={11} /></div>
    </Html>}
  </group>
})

// ---------------------------------------------------------------- camera

type Goal = { target: THREE.Vector3; zoom: number; theta?: number; phi?: number }

const Rig = forwardRef<SceneHandle, { selected: string; focus: boolean; resetKey: number; onChange: (state: { azimuth: number; zoom: number }) => void }>(function Rig({ selected, focus, resetKey, onChange }, ref) {
  const camera = useThree(s => s.camera) as THREE.OrthographicCamera
  const size = useThree(s => s.size)
  const controls = useRef<any>(null)
  const goal = useRef<Goal | null>(null)
  const placed = useRef(false)
  const prevBase = useRef(0)
  const base = useMemo(() => Math.max(.05, Math.min(size.width, size.height*1.35) / (Math.hypot(bounds.w, bounds.d)*.78)), [size.width, size.height])
  const baseRef = useRef(base); baseRef.current = base
  const focusRef = useRef(focus); focusRef.current = focus

  const place = (theta: number, phi: number, target: THREE.Vector3, radius = 2600) => {
    const s = new THREE.Spherical(radius, phi, theta)
    camera.position.copy(new THREE.Vector3().setFromSpherical(s).add(target))
    controls.current?.target.copy(target)
    camera.lookAt(target)
    controls.current?.update()
  }
  const buildingCentre = (id: string) => {
    const b = campusBuildings.find(x => x.id === id)!
    const m = modelFor(b), pts = m.footprint.flatMap(r => r.points)
    const xs = pts.map(p => p[0]), zs = pts.map(p => p[1])
    return new THREE.Vector3((Math.min(...xs)+Math.max(...xs))/2, m.topY/2, (Math.min(...zs)+Math.max(...zs))/2)
  }
  const current = () => {
    const c = controls.current, offset = camera.position.clone().sub(c.target)
    return new THREE.Spherical().setFromVector3(offset)
  }
  const homeGoal = (): Goal => ({ target: centre.clone(), zoom: baseRef.current, theta: HOME.azimuth, phi: Math.PI/2 - HOME.elevation })
  const focusGoal = (id: string): Goal => ({ target: buildingCentre(id), zoom: baseRef.current*4.2 })

  useEffect(() => { // initial placement and resize
    const ratio = prevBase.current ? base / prevBase.current : 1
    camera.zoom = prevBase.current ? camera.zoom * ratio : base
    if (goal.current) goal.current.zoom *= ratio
    prevBase.current = base
    camera.near = 1; camera.far = 8000; camera.updateProjectionMatrix()
    if (!controls.current || placed.current) return
    placed.current = true
    place(HOME.azimuth, Math.PI/2 - HOME.elevation, centre)
  }, [base]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { goal.current = focus ? focusGoal(selected) : homeGoal() }, [focus, selected]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (resetKey) goal.current = homeGoal() }, [resetKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    zoomBy: f => { goal.current = { target: controls.current.target.clone(), zoom: THREE.MathUtils.clamp(camera.zoom*f, base*.35, base*14) } },
    rotateBy: deg => { const s = current(); goal.current = { target: controls.current.target.clone(), zoom: camera.zoom, theta: s.theta + THREE.MathUtils.degToRad(deg), phi: s.phi } },
    panBy: (right, forward) => {
      const s = current(), step = 60 / camera.zoom*base
      const r = new THREE.Vector3(Math.cos(s.theta), 0, -Math.sin(s.theta)), f = new THREE.Vector3(-Math.sin(s.theta), 0, -Math.cos(s.theta))
      goal.current = { target: controls.current.target.clone().addScaledVector(r, right*step).addScaledVector(f, forward*step), zoom: camera.zoom }
    },
    setFocus: on => { goal.current = on ? focusGoal(selected) : homeGoal() },
    reset: () => { goal.current = homeGoal() },
  }), [selected, base]) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
    const c = controls.current
    if (!c) return
    const g = goal.current
    if (g && c.enableDamping) { c.enableDamping = false; c.update() } // flush orbit inertia so it cannot fight the move
    if (!g && !c.enableDamping) c.enableDamping = true
    if (g) {
      const k = 1 - Math.pow(.0009, dt)
      const s = current()
      if (g.theta !== undefined) {
        let d = g.theta - s.theta
        d = Math.atan2(Math.sin(d), Math.cos(d))
        s.theta += d*k
        if (g.phi !== undefined) s.phi += (g.phi - s.phi)*k
      }
      c.target.lerp(g.target, k)
      camera.position.copy(new THREE.Vector3().setFromSpherical(s).add(c.target))
      camera.zoom += (g.zoom - camera.zoom)*k
      camera.updateProjectionMatrix()
      c.update()
      const done = c.target.distanceTo(g.target) < .5 && Math.abs(g.zoom - camera.zoom) < g.zoom*.002 && (g.theta === undefined || Math.abs(Math.atan2(Math.sin(g.theta - s.theta), Math.cos(g.theta - s.theta))) < .002)
      if (done) goal.current = null
    }
    const s = current()
    onChange({ azimuth: THREE.MathUtils.radToDeg(s.theta), zoom: camera.zoom / baseRef.current })
  })

  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.12} rotateSpeed={.7} panSpeed={.9}
    minPolarAngle={.2} maxPolarAngle={Math.PI/2 - .08} minZoom={base*.35} maxZoom={base*14} zoomToCursor screenSpacePanning={false}
    onStart={() => { goal.current = null }} />
})

// ---------------------------------------------------------------- scene

function Lights() {
  const light = useRef<THREE.DirectionalLight>(null)
  useEffect(() => {
    const l = light.current
    if (!l) return
    l.shadow.camera.left = -1200; l.shadow.camera.right = 1200; l.shadow.camera.top = 1200; l.shadow.camera.bottom = -1200
    l.shadow.camera.near = 50; l.shadow.camera.far = 3200; l.shadow.camera.updateProjectionMatrix()
    l.shadow.bias = -.0004; l.shadow.normalBias = .6
  }, [])
  return <>
    <hemisphereLight args={['#fff7e4', '#bfae86', 1.05]} />
    <directionalLight ref={light} position={[-700, 1300, 900]} intensity={1.7} castShadow shadow-mapSize={[4096, 4096]} />
  </>
}

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}

export const CampusScene3D = forwardRef<SceneHandle, Props>(function CampusScene3D({ direction, selected, onSelect, cases, visible, exploded = false, selectedFloor = null, markers = true, focus = false, resetKey = 0 }, ref) {
  const p = direction.palette
  const [hover, setHover] = useState<string | null>(null)
  const [webgl] = useState(hasWebGL)
  const [ready, setReady] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true))); return () => cancelAnimationFrame(id) }, [])
  const wrapper = useRef<HTMLDivElement>(null)
  const rig = useRef<SceneHandle>(null)
  useImperativeHandle(ref, () => ({
    zoomBy: f => rig.current?.zoomBy(f), rotateBy: d => rig.current?.rotateBy(d), panBy: (r, f) => rig.current?.panBy(r, f),
    setFocus: on => rig.current?.setFocus(on), reset: () => rig.current?.reset(),
  }), [])
  const buildingRings = useMemo(() => campusBuildings.flatMap(b => modelFor(b).footprint.filter(r => r.role === 'outer').map(r => r.points)), [])
  const items = useMemo(() => campusBuildings.filter(b => !visible || visible.includes(b.id)), [visible])
  const audit = campusBuildings.filter(b => b.auditScope)
  const chosen = campusBuildings.find(b => b.id === selected)
  const slices = exploded && chosen?.hero ? chosen.floors : 0
  const onChange = useRef((state: { azimuth: number; zoom: number }) => {
    const el = wrapper.current
    if (el) { el.dataset.azimuth = state.azimuth.toFixed(1); el.dataset.zoom = state.zoom.toFixed(2) }
  }).current
  const keys = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    const map: Record<string, () => void> = {
      ArrowLeft: () => rig.current?.rotateBy(-15), ArrowRight: () => rig.current?.rotateBy(15),
      ArrowUp: () => rig.current?.panBy(0, 1), ArrowDown: () => rig.current?.panBy(0, -1),
      '+': () => rig.current?.zoomBy(1.4), '=': () => rig.current?.zoomBy(1.4), '-': () => rig.current?.zoomBy(1/1.4),
      a: () => rig.current?.panBy(-1, 0), d: () => rig.current?.panBy(1, 0),
    }
    const action = map[e.key]
    if (action) { e.preventDefault(); action() }
  }
  if (!webgl) return <div className="scene-fallback3d" role="note"><b>3D view unavailable</b><p>This browser cannot create a WebGL context. Choose a building from the index to open its evidence.</p></div>
  return <div ref={wrapper} className="campus-scene3d" role="group" tabIndex={0} onKeyDown={keys}
    aria-label="Interactive 3D model of the IIT Roorkee campus. Drag to rotate, right-drag or arrow keys to move, scroll or plus and minus to zoom."
    data-selected={selected} data-building-count={items.length} data-floor-slices={slices} data-testid="campus-scene3d">
    {!ready && <p className="scene-loading3d" role="status">Building the 3D campus…</p>}
    {ready && <Canvas orthographic shadows="soft" dpr={[1, 2]} gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      camera={{ position: [0, 2000, 2000], zoom: .4, near: 1, far: 8000 }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NoToneMapping; gl.outputColorSpace = THREE.SRGBColorSpace }}
      onPointerMissed={() => setHover(null)}>
      <color attach="background" args={[p.scene]} />
      <Lights />
      <Terrain buildingRings={buildingRings} />
      {items.map(b => <BuildingMesh key={b.id} b={b} selected={b.id === selected} hovered={hover === b.id} watts={loadFor(b.id, cases)}
        exploded={exploded} floor={selectedFloor} accent={p.accent} markers={markers} onSelect={onSelect} onHover={setHover} />)}
      <Rig ref={rig} selected={selected} focus={focus} resetKey={resetKey} onChange={onChange} />
    </Canvas>}
    <ul className="sr-only" aria-label="Audited buildings">
      {audit.map(b => <li key={b.id}><button tabIndex={-1} onClick={() => onSelect(b.id)} aria-pressed={selected === b.id}>{`Select ${b.name}, ${number(loadFor(b.id, cases))} watts in sample observations`}</button></li>)}
    </ul>
  </div>
})
