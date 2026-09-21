import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Html, Line } from '@react-three/drei'
import * as THREE from 'three'
import { Zap } from 'lucide-react'
import { buildings, getBuilding } from '../data'
import { usePulseStore } from '../store'
import { useEffect, useRef, useState } from 'react'

function BuildingMesh({ id }: { id: string }) {
  const building = getBuilding(id)
  const selectedId = usePulseStore((state) => state.selectedId)
  const select = usePulseStore((state) => state.select)
  const heatmap = usePulseStore((state) => state.heatmap)
  const selected = selectedId === id
  const priority = building.status === 'Priority review'
  const height = building.id === 'lhc' ? 2.7 : 1.5 + building.floors * 0.18
  const windows = Math.max(2, Math.floor(building.w / 0.45))
  return <group position={[building.x, height / 2, building.z]} onClick={(event) => { event.stopPropagation(); select(id) }}>
    <mesh castShadow receiveShadow><boxGeometry args={[building.w, height, building.d]} /><meshStandardMaterial color={selected ? '#d6c6a4' : building.color} roughness={0.78} metalness={0.08} emissive={selected || (heatmap && priority) ? '#8d5b27' : '#000000'} emissiveIntensity={selected ? 0.22 : priority ? 0.1 : 0} /></mesh>
    {Array.from({ length: windows }).map((_, index) => <mesh key={index} position={[-building.w / 2 + .28 + index * .42, .45, building.d / 2 + .012]}><boxGeometry args={[.22, .18, .02]} /><meshStandardMaterial color={priority || selected ? '#e4ab4d' : '#9db4ba'} emissive={priority || selected ? '#d87926' : '#112028'} emissiveIntensity={priority || selected ? .8 : .2} /></mesh>)}
    {building.id === 'lhc' && <FloorStack height={height} width={building.w} depth={building.d} />}
    {selected && <Html position={[0, height + .35, 0]} center><div className="scene-label"><span>{building.short}</span><b>{building.load} W</b></div></Html>}
    {priority && heatmap && <mesh position={[0, .04, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.15, 32]} /><meshBasicMaterial color="#e18b35" transparent opacity={.12} /></mesh>}
  </group>
}

function FloorStack({ height, width, depth }: { height: number; width: number; depth: number }) {
  const selectedId = usePulseStore((state) => state.selectedId)
  const hovered = useRef(false)
  useFrame((_, delta) => { hovered.current = hovered.current || selectedId === 'lhc'; void delta })
  return <group>{[1, 2, 3].map((floor) => <Line key={floor} points={[[-width / 2, floor * .68 - height / 2, depth / 2 + .03], [width / 2, floor * .68 - height / 2, depth / 2 + .03]]} color="#f2ca77" transparent opacity={selectedId === 'lhc' ? .65 : .18} lineWidth={1} />)}</group>
}

function Ground() { return <group><mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[22, 16]} /><meshStandardMaterial color="#111b20" roughness={1} /></mesh><gridHelper args={[22, 22, '#213038', '#162329']} rotation={[0, 0, 0]} position={[0, .012, 0]} /><Line points={[[-9, 0.03, -6], [9, 0.03, -6], [9, 0.03, 6], [-9, 0.03, 6], [-9, 0.03, -6]]} color="#39515a" lineWidth={1} /></group> }

function SceneContents() { const filter = usePulseStore((state) => state.filter); const visible = buildings.filter((building) => filter === 'all' || (filter === 'priority' ? building.status === 'Priority review' : building.audits > 0)); return <><ambientLight intensity={1.2} color="#8da4b0" /><directionalLight position={[-5, 10, 6]} intensity={3} color="#ffe1a5" castShadow shadow-mapSize={[1024, 1024]} /><pointLight position={[0, 4, 3]} intensity={7} color="#db8a37" distance={9} /><Ground />{visible.map((building) => <BuildingMesh key={building.id} id={building.id} />)}<OrbitControls makeDefault enablePan={false} minDistance={10} maxDistance={23} target={[0, 0, 0]} maxPolarAngle={Math.PI / 2.2} minPolarAngle={Math.PI / 4.5} /></> }

function SceneFallback() { return <div className="scene-fallback"><div className="fallback-icon"><Zap size={20} /></div><b>3D view unavailable</b><p>The audit index is still fully available in the building list. Select a row to open its evidence trail.</p></div> }

export function CampusScene() { const [webgl, setWebgl] = useState<boolean | null>(null); useEffect(() => { const canvas = document.createElement('canvas'); const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl'); setWebgl(Boolean(context)); }, []); if (webgl === null) return <div className="scene-fallback"><span className="eyebrow">Preparing local scene</span></div>; if (!webgl) return <SceneFallback />; return <Canvas shadows dpr={[1, 1.6]} camera={{ position: [11, 11, 12], fov: 37 }} gl={{ antialias: true }}><SceneContents /></Canvas> }
