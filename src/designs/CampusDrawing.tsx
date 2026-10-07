import { memo, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { CampusTheme } from './theme'
import { campusBuildings, loadFor, number } from './fixtures'
import type { CampusBuilding, Case } from './fixtures'
import { footprintFor, outlineEdges } from './buildingGeometry'
import type { FootprintRing, Point2 } from './buildingGeometry'
import { GeographicView } from './GeographicView'

// The projection and cuboid vocabulary are adapted from the user's Figma Make export.
type V3 = [number, number, number]
const project = ([x, y, z]: V3) => [(x - y) * 32, (x + y) * 16 - z]
const point = (p: V3) => project(p).join(',')
const polygon = (points: V3[]) => points.map(point).join(' ')
const plane = (x: number, y: number, w: number, d: number, z = 0) => polygon([[x,y,z], [x+w,y,z], [x+w,y+d,z], [x,y+d,z]])
type BoxProps = { x: number; y: number; w: number; d: number; bottom?: number; height: number; fills: [string, string, string]; line: string; stroke?: number; windows?: boolean; windowColor?: string; hatch?: string }

const roofPath = (rings: FootprintRing[], z: number | ((p: Point2) => number)) => rings.map(r => r.points.map((p, i) => `${i ? 'L' : 'M'}${point([p[0], p[1], typeof z === 'number' ? z : z(p)])}`).join(' ') + 'Z').join(' ')

// Buildings are extruded from sourced polygon rings, including courtyard voids.
// Windows/floor heights are visual abstractions, not measured elevations.
function FootprintVolume({ rings, bottom = 0, height, fills, line, windowColor, windows = true, hatch, floors = 3, sloped = false }: {
  rings: FootprintRing[]; bottom?: number; height: number; fills: [string,string,string]; line: string;
  windowColor: string; windows?: boolean; hatch?: string; floors?: number; sloped?: boolean;
}) {
  const edges = outlineEdges(rings).filter(e => e.normal[0] + e.normal[1] > .025).sort((a,b) => (a.a[0]+a.a[1]+a.b[0]+a.b[1])-(b.a[0]+b.a[1]+b.b[0]+b.b[1]))
  const pts = rings.flatMap(r => r.points), minY = Math.min(...pts.map(p => p[1])), maxY = Math.max(...pts.map(p => p[1]))
  const top = (p: Point2) => bottom + height + (sloped ? (maxY-p[1])/(maxY-minY)*1.8 : 0)
  return <g stroke={line} strokeWidth=".75" strokeLinejoin="round" data-geometry="osm-footprint">
    {edges.map((e,i) => <g key={i} data-wall={e.role}>
      <polygon points={polygon([[...e.a,bottom],[...e.b,bottom],[...e.b,top(e.b)],[...e.a,top(e.a)]])} fill={e.normal[0] > e.normal[1] ? fills[2] : fills[1]} />
      {hatch && <polygon points={polygon([[...e.a,bottom],[...e.b,bottom],[...e.b,top(e.b)],[...e.a,top(e.a)]])} fill={`url(#${hatch})`} opacity=".3" stroke="none" />}
      {windows && e.length > .22 && Array.from({length:floors},(_,floor) => {
        const base = bottom + floor*height/floors+height/floors*.22
        const n = Math.max(1,Math.floor(e.length/.24))
        return <g key={floor} strokeWidth=".3">{Array.from({length:n},(_,c) => {
          const a = (c+.22)/n, b = (c+.74)/n
          const pa: Point2 = [e.a[0]+(e.b[0]-e.a[0])*a,e.a[1]+(e.b[1]-e.a[1])*a]
          const pb: Point2 = [e.a[0]+(e.b[0]-e.a[0])*b,e.a[1]+(e.b[1]-e.a[1])*b]
          return <polygon key={c} points={polygon([[...pa,base],[...pb,base],[...pb,base+height/floors*.43],[...pa,base+height/floors*.43]])} fill={windowColor} />
        })}</g>
      })}
      {Array.from({length:floors-1},(_,f) => <polyline key={`level${f}`} points={polygon([[...e.a,bottom+(f+1)*height/floors],[...e.b,bottom+(f+1)*height/floors]])} strokeWidth="1.4" stroke={line==='transparent'?fills[0]:line} opacity=".65" />)}
    </g>)}
    <path d={roofPath(rings,top)} fill={fills[0]} fillRule="evenodd" />
  </g>
}

function ArchitecturalDetails({b,rings,direction,fills}: {b:CampusBuilding;rings:FootprintRing[];direction:CampusTheme;fills:[string,string,string]}) {
  const p = direction.palette
  const line = p.line === 'transparent' ? fills[2] : p.line
  const edges = outlineEdges(rings).filter(e=>e.role==='outer' && e.length>(b.id==='mgcl'?.07:.35) && e.normal[0]+e.normal[1]>.1)
  const facade = b.id==='mgcl' ? edges.filter(e=>e.normal[0]>.45) : edges
  return <g pointerEvents="none" strokeLinejoin="round" data-detail={b.id}>
    {/* Low parapets follow actual wings instead of a generic rooftop box. */}
    {b.id!=='sac'&&edges.map((e,i)=><polygon key={`parapet${i}`} points={polygon([[...e.a,b.h],[...e.b,b.h],[...e.b,b.h+.6],[...e.a,b.h+.6]])} fill={fills[1]} stroke={line} strokeWidth=".35" />)}
    {b.id==='mgcl'&&<>
      {/* East glazed frontage and colonnade, studied from IITR's MGCL photographs. */}
      {facade.map((e,i)=><g key={i}>
        <polygon points={polygon([[...e.a,b.h*.08],[...e.b,b.h*.08],[...e.b,b.h*.92],[...e.a,b.h*.92]])} fill={p.window} stroke={line} strokeWidth=".3" />
        {[.18,.82].map(t=>{
          const x=e.a[0]+(e.b[0]-e.a[0])*t+.04, y=e.a[1]+(e.b[1]-e.a[1])*t
          return <g key={t}><path d={`M${point([x,y,b.h*.06])}L${point([x,y,b.h*.98])}`} stroke={fills[0]} strokeWidth="1.3" /><path d={`M${point([x-.015,y,b.h*.88])}L${point([x+.02,y,b.h*.88])}`} stroke={line} strokeWidth=".3" /></g>
        })}
        {[.25,.5,.75].map(t=><polyline key={t} points={polygon([[...e.a,b.h*(.08+.84*t)],[...e.b,b.h*(.08+.84*t)]])} stroke={fills[0]} strokeWidth=".35" />)}
      </g>)}
      {[0,1,2,3].map(s=><Box key={s} x={b.x+b.w-.025+s*.022} y={b.y+b.d*.26} w={.04} d={b.d*.48} height={.5-s*.1} fills={fills} line={line} />)}
    </>}
    {b.id==='mac'&&edges.map((e,i)=><g key={i}>
      {/* MAC's open roof-level concrete frames; its court stays genuinely hollow. */}
      <polyline points={polygon([[...e.a,b.h],[...e.a,b.h+2.3],[...e.b,b.h+2.3],[...e.b,b.h]])} stroke={fills[2]} strokeWidth=".9" fill="none" />
      {Array.from({length:Math.max(1,Math.floor(e.length/.2))},(_,j)=>{const t=j/Math.max(1,Math.floor(e.length/.2));const pt:Point2=[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t];return <polyline key={j} points={polygon([[...pt,b.h],[...pt,b.h+2.3]])} stroke={fills[2]} strokeWidth=".7" />})}
    </g>)}
    {b.id==='sac'&&<>
      {/* Official SAC photos: diagonal screening and a projecting skillion roof. */}
      {edges.map((e,i)=><g key={i}>{Array.from({length:3},(_,row)=>Array.from({length:Math.max(2,Math.floor(e.length/.22))},(_,j)=>{
        const n=Math.max(2,Math.floor(e.length/.22)), t=(j+.1)/n,u=(j+.85)/n,z=b.h*(.2+row*.23)
        return <polyline key={`${row}-${j}`} points={polygon([[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t,z],[e.a[0]+(e.b[0]-e.a[0])*u,e.a[1]+(e.b[1]-e.a[1])*u,z+b.h*.17]])} stroke={fills[0]} strokeWidth=".85" />
      }))}</g>)}
      <FootprintVolume rings={rings.map(r=>({...r,points:r.points.map(([x,y])=>[b.x+b.w/2+(x-b.x-b.w/2)*1.05,b.y+b.d/2+(y-b.y-b.d/2)*1.05] as Point2)}))} bottom={b.h+.5} height={.5} fills={fills} line={line} windowColor={p.window} windows={false} floors={1} sloped />
    </>}
    {b.id==='lhc'&&edges.filter(e=>e.length>.8).map((e,i)=><g key={i}>
      {/* Repeated schematic bays; no LHC-II transplant onto the mapped older LHC. */}
      {Array.from({length:Math.floor(e.length/.2)},(_,j)=>{const t=(j+.5)/Math.floor(e.length/.2);const pt:Point2=[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t];return <polyline key={j} points={polygon([[...pt,.4],[...pt,b.h-.4]])} stroke={fills[0]} strokeWidth=".8" />})}
    </g>)}
  </g>
}

function Box({ x, y, w, d, bottom = 0, height, fills, line, stroke = .8, windows, windowColor, hatch }: BoxProps) {
  const z = bottom + height
  const left = polygon([[x,y+d,bottom], [x+w,y+d,bottom], [x+w,y+d,z], [x,y+d,z]])
  const right = polygon([[x+w,y+d,bottom], [x+w,y,bottom], [x+w,y,z], [x+w,y+d,z]])
  return <g stroke={line} strokeWidth={stroke} strokeLinejoin="round">
    <polygon points={left} fill={fills[1]} />
    <polygon points={right} fill={fills[2]} />
    {hatch && <polygon points={right} fill={`url(#${hatch})`} stroke="none" opacity=".45" />}
    {windows && Array.from({ length: Math.max(1, Math.floor((height - 8) / 14)) }, (_, r) => {
      const a = bottom + 7 + r * 14
      return <g key={r} strokeWidth={.45}>{Array.from({length: Math.max(2, Math.floor(w * 2))}, (_, c) => {
        const t = x + w * (c + .25) / Math.floor(w * 2)
        return <polygon key={`f${c}`} points={polygon([[t,y+d,a],[t+.21,y+d,a],[t+.21,y+d,a+6],[t,y+d,a+6]])} fill={windowColor} />
      })}{Array.from({length: Math.max(2, Math.floor(d * 2))}, (_, c) => {
        const t = y + d * (c + .25) / Math.floor(d * 2)
        return <polygon key={`s${c}`} points={polygon([[x+w,t,a],[x+w,t+.21,a],[x+w,t+.21,a+6],[x+w,t,a+6]])} fill={windowColor} />
      })}</g>
    })}
    <polygon points={plane(x, y, w, d, z)} fill={fills[0]} />
  </g>
}


function buildingFills(b: CampusBuilding): [string,string,string] {
  // Category colors are independent of observed electricity load.
  if (b.kind === 'Residence') return ['#f3bab3','#e9a099','#be7775']
  if (['Academic','Department','Library'].includes(b.kind)) return ['#a9c6d0','#5594ad','#356a88']
  return ['#d0dcba','#8ab298','#668d79']
}

const BuildingShape=memo(function BuildingShape({ b, direction, selected, exploded, selectedFloor, watts, detailed, zoom, onSelect, onHover }: { b: CampusBuilding; direction: CampusTheme; selected: boolean; exploded: boolean; selectedFloor: number | null; watts: number; detailed: boolean; zoom: number; onSelect: (id: string) => void; onHover: (id: string|null) => void }) {
  const p = direction.palette
  const fills = buildingFills(b)
  const keyAction = (event: KeyboardEvent<SVGGElement>) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(b.id) } }
  const rings = footprintFor(b)
  const shared = { rings, fills, line: p.line, windows: detailed, windowColor: p.window }
  const [cx,cy] = project([b.x+b.w/2,b.y+b.d/2,0])
  return <g className="campus-building" data-building-id={b.id} data-selected={selected} role="button" tabIndex={b.auditScope?0:-1} aria-label={`Select ${b.name}, ${b.auditScope?`${number(watts)} watts in sample observations`:'not audited'}`} aria-pressed={selected} onClick={()=>onSelect(b.id)} onKeyDown={keyAction} onMouseEnter={()=>onHover(b.id)} onMouseLeave={()=>onHover(null)}>
    <path d={roofPath(rings.map(r=>({...r,points:r.points.map(([x,y])=>[x+.025,y+.035] as Point2)})),.1)} fill={p.ink} fillRule="evenodd" opacity=".1" />
    {selected && <path className="selected-footprint" d={roofPath(rings,1)} fill={p.accent} fillRule="evenodd" fillOpacity=".2" stroke={p.accent} strokeWidth="2.5" />}
    <g className="building-lift">
      {exploded && selected && b.hero ? Array.from({ length: b.floors }, (_, floor) => <g key={floor} opacity={selectedFloor !== null && selectedFloor !== floor ? .4 : 1}>
        <FootprintVolume bottom={floor * (b.h / b.floors + 19)} height={b.h / b.floors - 1} floors={1} {...shared} />
        <path d={roofPath(rings,floor*(b.h/b.floors+19)+b.h/b.floors)} fill={p.accent} fillRule="evenodd" opacity=".24" />
      </g>) : <>
        <FootprintVolume height={b.h} floors={b.floors} {...shared} />
        {b.hero && <ArchitecturalDetails b={b} rings={rings} direction={direction} fills={fills} />}
        {b.id==='osm-relation-8255183'&&<g data-detail="thomason" transform={`translate(${project([b.x+b.w*.5,b.y+b.d*.12,b.h]).join(' ')})`}><ellipse cy="-1" rx="5" ry="2.2" fill={fills[1]} stroke={p.line} strokeWidth=".4"/><path d="M-5-1Q-5-7 0-8Q5-7 5-1Z" fill={fills[0]} stroke={p.line} strokeWidth=".4"/><path d="M0-8V-10" stroke={p.line==='transparent'?fills[2]:p.line} strokeWidth=".6"/></g>}
      </>}
    </g>
    {(b.auditScope||b.id==='osm-relation-8255183'||selected)&&<g transform={`translate(${cx},${cy+8}) scale(${1/zoom})`} pointerEvents="none"><text textAnchor="middle" fill={p.ink} fontSize="11" fontWeight="600" opacity={selected ? 1 : .85}>{b.short}</text></g>}
    {watts > 0 && <g transform={`translate(${cx},${cy-b.h-9-(exploded&&selected?b.floors*19:0)}) scale(${1/zoom})`} pointerEvents="none"><circle r="6" fill={selected ? p.accent : p.surface} stroke={p.line === 'transparent' ? p.border : p.line} strokeWidth="1" /><path d="M1-4-3 1H0L-1 4 3-1H0Z" fill={selected ? p.onAccent : p.ink} /></g>}
  </g>
})

type Props = { direction: CampusTheme; selected: string; onSelect: (id: string)=>void; cases?: Case[]; visible?: string[]; exploded?: boolean; selectedFloor?: number|null; zoom?: number; rotation?: number; markers?: boolean; focus?:boolean; resetKey?:number }

export function CampusDrawing({ direction, selected, onSelect, cases, visible, exploded = false, selectedFloor = null, zoom = 1, rotation = 0, markers = true, focus=false, resetKey=0 }: Props) {
  const p = direction.palette
  const [hover, setHover] = useState<string|null>(null)
  const items = useMemo(()=>[...campusBuildings].sort((a,b)=>(a.x+a.w+a.y+a.d)-(b.x+b.w+b.y+b.d)),[])
  const selectedBuilding=campusBuildings.find(b=>b.id===selected)!
  const lift=exploded?selectedBuilding.h/2+selectedBuilding.floors*19/2:selectedBuilding.h/2
  const focusPoint:Point2|null=focus?[selectedBuilding.x+selectedBuilding.w/2-lift/32,selectedBuilding.y+selectedBuilding.d/2-lift/32]:null
  const chosen = campusBuildings.find(b=>b.id===(hover||selected))
  const labelPos = chosen ? project([chosen.x+chosen.w/2,chosen.y+chosen.d/2,chosen.h+(exploded&&chosen.id===selected?chosen.floors*19:0)+18]) : [0,0]
  return <GeographicView direction={direction} zoom={zoom} rotation={rotation} focusPoint={focusPoint} resetKey={`${resetKey}-${focus}-${focus?selected:''}`}>
      {items.filter(b=>!visible||visible.includes(b.id)).map(b=><BuildingShape key={b.id} b={b} direction={direction} selected={selected===b.id} onSelect={onSelect} onHover={setHover} exploded={exploded} selectedFloor={selectedFloor} watts={markers?loadFor(b.id,cases):0} detailed={!!b.auditScope||selected===b.id} zoom={zoom} />)}
      {chosen&&(!visible||visible.includes(chosen.id))&&<g transform={`translate(${labelPos[0]},${labelPos[1]}) scale(${1/zoom})`} pointerEvents="none">
        <path d="M0 17V28" stroke={p.accent} strokeWidth="1" />
        <rect x="-74" y="-9" width="148" height="25" rx={direction.radius?5:0} fill={p.accent} />
        <text textAnchor="middle" y="7" fontSize="11" fontWeight="600" fill={p.onAccent}>{chosen.short} / {chosen.auditScope?`${number(loadFor(chosen.id,cases))} W`:'Not audited'}</text>
      </g>}
  </GeographicView>
}
