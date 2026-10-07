import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { CampusTheme } from './theme'
import { campusBoundary, geographicToScene, metersPerSceneUnit } from './buildingGeometry'
import type { Point2 } from './buildingGeometry'
import { campusMap } from './campusData'

export const projectPlan=(p:Point2):Point2=>[(p[0]-p[1])*32,(p[0]+p[1])*16]
export const planPath=(points:Point2[],closed=false)=>points.map((p,i)=>`${i?'L':'M'}${projectPlan(p).join(',')}`).join(' ')+(closed?'Z':'')
const groundRings=[{role:'outer',points:campusBoundary}]
const roads=campusMap.roads.map(r=>({...r,points:r.coordinates.map(p=>geographicToScene(p as Point2))}))
const surfaces=campusMap.surfaces.map(s=>({...s,rings:s.rings.map(r=>({...r,points:r.coordinates.map(p=>geographicToScene(p as Point2))}))}))
const trees=campusMap.trees.map(t=>({...t,point:geographicToScene(t.coordinates as Point2)}))
function viewBounds() {
  const points=campusBoundary.map(p=>projectPlan(p)),xs=points.map(p=>p[0]),ys=points.map(p=>p[1])
  const minX=Math.min(...xs)-45,minY=Math.min(...ys)-60
  return {x:minX,y:minY,w:Math.max(...xs)-minX+45,h:Math.max(...ys)-minY+65}
}

// Camera transforms affect the whole world. Building sizes and locations do not
// change on selection. Touch/mouse drag and arrow-key panning share screen axes.
export function GeographicView({direction,zoom,rotation,focusPoint,resetKey,children}:{direction:CampusTheme;zoom:number;rotation:number;focusPoint:Point2|null;resetKey:string;children:ReactNode}) {
  const uid=useId().replace(/:/g,''),clip=`campus-clip-${uid}`,p=direction.palette
  const bounds=viewBounds(),center:Point2=[bounds.x+bounds.w/2,bounds.y+bounds.h/2]
  const anchor=focusPoint?projectPlan(focusPoint):center
  const [pan,setPan]=useState<Point2>([0,0])
  const drag=useRef<{id:number;x:number;y:number;pan:Point2;unit:number}|null>(null),moved=useRef(false)
  useEffect(()=>setPan([0,0]),[resetKey])
  const path=(rings:typeof groundRings)=>rings.map(r=>planPath(r.points,true)).join(' ')
  const groundPath=path(groundRings)
  const finish=()=>{drag.current=null}
  return <svg className="campus-drawing geographic-drawing" viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`} role="group" aria-label="Geographic IIT Roorkee campus model. Arrow keys pan; drag to move; use zoom or focus controls." tabIndex={0}
    onKeyDown={e=>{if(e.target!==e.currentTarget)return;const shifts:Record<string,Point2>={ArrowLeft:[45,0],ArrowRight:[-45,0],ArrowUp:[0,45],ArrowDown:[0,-45]};const shift=shifts[e.key];if(shift){e.preventDefault();setPan(([x,y])=>[x+shift[0],y+shift[1]])}}}
    onPointerDown={e=>{if(e.button!==0)return;moved.current=false;const rect=e.currentTarget.getBoundingClientRect();drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,pan,unit:Math.max(bounds.w/rect.width,bounds.h/rect.height)}}}
    onPointerMove={e=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.hypot(dx,dy)>5){moved.current=true;e.currentTarget.setPointerCapture(e.pointerId);setPan([d.pan[0]+dx*d.unit,d.pan[1]+dy*d.unit])}}}
    onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onClickCapture={e=>{if(moved.current){e.preventDefault();e.stopPropagation()}}}>
    <defs><clipPath id={clip}><path d={groundPath}/></clipPath></defs>
    <g data-world-transform transform={`translate(${center[0]+pan[0]} ${center[1]+pan[1]}) scale(${zoom}) rotate(${rotation}) translate(${-anchor[0]} ${-anchor[1]})`}>
      <path d={groundPath} transform="translate(0 6)" fill={p.groundSide} stroke={p.line} strokeWidth=".5"/>
      <path d={groundPath} data-campus-boundary fill={p.ground} stroke={p.line==='transparent'?p.border:p.line} strokeWidth="1"/>
      <g clipPath={`url(#${clip})`} pointerEvents="none">
        {surfaces.map(s=><path key={s.id} data-surface-id={s.id} d={path(s.rings)} fill={/water|pool/.test(s.type)?p.medium:/pitch|track|sports/.test(s.type)?p.road:p.lawn} fillRule="evenodd" fillOpacity={/wood|forest/.test(s.type)?'.9':'.65'} stroke={/pitch|track/.test(s.type)?p.line:'none'} strokeWidth=".45"/>)}
        {roads.map(r=>{const pedestrian=/footway|path|steps|pedestrian|cycleway/.test(r.type);const width=Number.parseFloat(r.width??'')||(pedestrian?1.8:r.type==='service'?4:6);return <path key={r.id} data-road-id={r.id} d={planPath(r.points)} fill="none" stroke={pedestrian?p.surface:p.road} strokeWidth={width*32/metersPerSceneUnit} strokeLinecap="round" strokeLinejoin="round" opacity={pedestrian?'.7':'1'}/>})}
        {trees.map(t=>{const [x,y]=projectPlan(t.point);return <g key={t.id} data-tree-id={t.id} transform={`translate(${x} ${y})`}><ellipse rx="2.5" ry="1.4" fill={p.tree}/><circle cy="-3" r="2.5" fill={p.tree} stroke="none" strokeWidth=".3"/></g>})}
      </g>
      {children}
    </g>
    <g pointerEvents="none" transform={`translate(${bounds.x+25} ${bounds.y+bounds.h-28})`} fill={p.ink} fontSize="12"><path d="M0 0 21-11M14-11 21-11 17-5" fill="none" stroke={p.ink} strokeWidth="1" transform={`rotate(${rotation})`}/><text x="25" y="-11">N</text><text x="48" y="0">WGS84 · mapped campus boundary</text></g>
  </svg>
}
