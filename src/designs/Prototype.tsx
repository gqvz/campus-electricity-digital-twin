import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, Compass, Eye, FileText, Focus, Grid2X2, Layers, Map, Minus, Plus, RotateCcw, Search, SlidersHorizontal, Sparkles, X, Zap } from 'lucide-react'
import { chromatic } from './theme'
import { CampusDrawing } from './CampusDrawing'
import { campusBuildings, caseEnergy, caseWatts, demoCases, floorName, loadFor, number, verifiedTotal } from './fixtures'
import type { CampusBuilding, Case } from './fixtures'
import { campusStats, footprintSources } from './buildingGeometry'

export function CubeMark() { return <svg width="28" height="32" viewBox="0 0 28 32" fill="none" aria-hidden="true"><path d="M14 1 27 8.5V23.5L14 31 1 23.5V8.5Z" stroke="currentColor" strokeWidth="1.4" /><path d="M1 8.5 14 16 27 8.5M14 16V31M7.5 5 20.5 12.5V27.2M7.5 12.2V27.2M1 16 14 23.5 27 16" stroke="currentColor" strokeWidth="1.1" /></svg> }
const windows = ['All times','Morning','Afternoon','Evening','Night']
const devices = ['All devices','Lights','Fans','AC']

function Evidence({ building, cases, floor, onCase }: { building: CampusBuilding; cases: Case[]; floor: number|null; onCase: (c: Case)=>void }) {
  const list = cases.filter(c=>c.buildingId===building.id&&(floor===null||c.floor===floor))
  const watts = list.reduce((sum,c)=>sum+caseWatts(c),0)
  const energy = list.reduce((sum,c)=>sum+(caseEnergy(c)??0),0)
  if(!building.auditScope)return <div className="evidence-content context-evidence">
    <div className="inspector-label"><span>{building.kind}</span><span className="hero-badge">Mapped context</span></div>
    <h2>{building.name}</h2>
    <div className="building-subtitle"><a href={footprintSources[building.id].source} target="_blank" rel="noreferrer">Map source ↗</a></div>
    <div className="prototype-empty"><Map size={23}/><h3>Not audited</h3><p>This building is included for campus context. No electricity-wastage observations have been attached.</p></div>
    <div className="intervention"><div><h3>Mapped footprint, shared scale</h3><p>Location, orientation and outline come from OSM. Approximate visualization height: {building.heightMeters?.toFixed(1)} m ({building.heightBasis?.toLowerCase()}).</p></div></div>
    {footprintSources[building.id].nameInference&&<p className="data-note">Name inferred from proximity to the APJ pin linked from IITR’s navigation page; confirm on campus.</p>}
    <p className="data-note">No surveyed elevation or room layout. An unnamed feature keeps its OSM identity rather than an invented name.</p>
  </div>
  return <div className="evidence-content">
    <div className="inspector-label"><span>{building.kind}</span><span className="hero-badge">{building.hero?'Architectural study':'Mapped outline'}</span></div>
    <h2>{building.name}</h2>
    <div className="building-subtitle">{building.short} <span>/</span> {building.floors} schematic floors <span>/</span> <a href={footprintSources[building.id as keyof typeof footprintSources].source} target="_blank" rel="noreferrer">Map source ↗</a></div>
    <div className="load-figure"><strong>{number(watts)}</strong><span>W<br /><small>observed avoidable load</small></span></div>
    <div className="load-segments" aria-hidden="true">{Array.from({length:24},(_,i)=><i key={i} style={{opacity:i<Math.min(24,Math.ceil(watts/60))?1:.15}} />)}</div>
    <div className="evidence-meta"><span><Check size={13} /> {list.length} sample cases</span><span><Clock3 size={13} /> 14 Feb, 2025</span></div>
    <div className="evidence-title"><h3>Evidence trail</h3><span>{floor===null?'All floors':floorName(floor)}</span></div>
    {list.length ? list.slice(0,3).map(c=><button className="observation-card" key={c.id} onClick={()=>onCase(c)}>
      <span className="obs-top"><span>{c.id} <span className="muted-copy">/ {floorName(c.floor)}</span></span><span className="obs-status">Unoccupied</span></span>
      <b>{c.zone}</b><span className="obs-bottom"><span><Zap size={12} /> {c.count} {c.device.toLowerCase()} active</span><strong>{caseWatts(c)} W <ArrowRight size={13} /></strong></span>
    </button>) : <div className="prototype-empty"><Eye size={19} /><p>No sample evidence in this selection.</p><small>Try another time window, floor, or building.</small></div>}
    <div className="intervention"><span className="intervention-icon"><Sparkles size={16} /></span><div><h3>Small change, real potential</h3><p>{list[0]?.recommendation??'Audit this building before recommending an intervention.'}</p></div></div>
    <div className="verified-energy"><span>Verified-duration estimate</span><strong>{energy?`${energy.toFixed(2)} kWh`:'Duration not verified'}</strong></div>
    <p className="data-note">Sample observations for design review. A single sighting supports watts; energy requires a verified duration.</p>
  </div>
}

function BuildingList({ cases, selected, onSelect, query, setQuery, kind, setKind, compact = false }: { cases: Case[]; selected: string; onSelect: (id:string)=>void; query: string; setQuery:(q:string)=>void; kind:string;setKind:(kind:string)=>void;compact?:boolean }) {
  const buildings = campusBuildings.filter(b=>(kind==='All buildings'||(kind==='Audit scope'?b.auditScope:b.kind===kind))&&`${b.name} ${b.short}`.toLowerCase().includes(query.toLowerCase()))
  return <div className={`audit-index ${compact?'compact-index':''}`}>
    <div className="index-title"><h3>Building index</h3><span>{buildings.length}</span></div>
    <label className="prototype-search"><Search size={15} /><input aria-label="Search buildings" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a building…" /></label>
    <label className="kind-select"><span className="sr-only">Building type</span><select value={kind} onChange={e=>setKind(e.target.value)}>{['All buildings','Audit scope','Academic','Library','Student life','Residence','Department','Other'].map(k=><option key={k}>{k}</option>)}</select><ChevronDown size={13}/></label>
    <div className="index-list">{buildings.map(b=><button key={b.id} className="index-row" data-selected={selected===b.id} aria-pressed={selected===b.id} onClick={()=>onSelect(b.id)}><span className="index-building-mark">{b.short}</span><span className="index-building-copy"><b>{b.name}</b><small>{b.kind}</small></span><strong>{loadFor(b.id,cases)?`${number(loadFor(b.id,cases))} W`:'—'}</strong></button>)}{!buildings.length&&<p className="prototype-empty">No matching buildings. Try a shorter name.</p>}</div>
  </div>
}

function Findings({ cases, onSelect }: { cases:Case[]; onSelect:(id:string)=>void }) {
  const ranked = [...campusBuildings].sort((a,b)=>loadFor(b.id,cases)-loadFor(a.id,cases))
  const maximum = Math.max(1,...ranked.map(b=>loadFor(b.id,cases)))
  return <div className="findings-surface"><div className="findings-heading"><span className="small-label">From the sample audit</span><h2>Where the next check matters.</h2><p>Compare recorded observations, then open a building to see the evidence.</p></div><div className="findings-columns"><section><h3>Building comparison <span>Observed W</span></h3>{ranked.filter(b=>loadFor(b.id,cases)>0).map(b=><button className="comparison-row" key={b.id} onClick={()=>onSelect(b.id)}><span>{b.name}</span><div><i style={{width:`${loadFor(b.id,cases)/maximum*100}%`}} /></div><b>{number(loadFor(b.id,cases))}</b></button>)}</section><section><h3>Device contribution</h3>{['Lights','Fans','AC'].map(device=>{const watts=cases.filter(c=>c.device===device).reduce((sum,c)=>sum+caseWatts(c),0);return <div key={device} className="device-breakdown"><span><Zap size={17}/>{device}</span><b>{number(watts)} W</b></div>})}<div className="findings-note"><Check size={18}/><p><b>{verifiedTotal.toFixed(2)} kWh</b> has an explicit verified duration in the complete fixture. Remaining observations stay in watts.</p></div><h3>Recommended first steps</h3><ol><li>Assign last-person-out checks.</li><li>Make switch labels clear.</li><li>Pilot occupancy controls in repeat hotspots.</li></ol></section></div><p className="data-note">Illustrative data. Loads recorded at different times are a comparison measure, not a campus-wide concurrent demand reading.</p></div>
}

export function ChromaticApp() {
  const direction = chromatic
  const p = direction.palette
  const [selected,setSelected] = useState('lhc')
  const [view,setView] = useState<'campus'|'findings'>('campus')
  const [period,setPeriod] = useState('All times')
  const [device,setDevice] = useState('All devices')
  const [query,setQuery] = useState('')
  const [kind,setKind] = useState('All buildings')
  const [floor,setFloor] = useState<number|null>(null)
  const [exploded,setExploded] = useState(false)
  const [zoom,setZoom] = useState(1)
  const [rotation,setRotation] = useState(0)
  const [focused,setFocused] = useState(false)
  const [resetKey,setResetKey] = useState(0)
  const [markers,setMarkers] = useState(true)
  const [caseOpen,setCaseOpen] = useState<Case|null>(null)
  const [indexOpen,setIndexOpen] = useState(false)
  const [tour,setTour] = useState<number|null>(null)
  const caseDialog = useRef<HTMLDivElement>(null)
  useEffect(()=>{
    if(!caseOpen)return
    const previous=document.activeElement as HTMLElement|null
    const dialog=caseDialog.current
    const controls=()=>Array.from(dialog?.querySelectorAll<HTMLElement>('button, a[href], select, input, [tabindex="0"]')??[])
    controls()[0]?.focus()
    const onKey=(event:globalThis.KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setCaseOpen(null)}
      if(event.key==='Tab'){const items=controls();const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
    }
    document.addEventListener('keydown',onKey,true)
    return()=>{document.removeEventListener('keydown',onKey,true);previous?.focus()}
  },[caseOpen])
  const building = campusBuildings.find(b=>b.id===selected)!
  const cases = useMemo(()=>demoCases.filter(c=>(device==='All devices'||c.device===device)&&(period==='All times'||(period==='Morning'&&c.hour<12)||(period==='Afternoon'&&c.hour>=12&&c.hour<17)||(period==='Evening'&&c.hour>=17&&c.hour<21)||(period==='Night'&&c.hour>=21))),[period,device])
  const visible = campusBuildings.filter(b=>(kind==='All buildings'||(kind==='Audit scope'?b.auditScope:b.kind===kind))&&`${b.name} ${b.short}`.toLowerCase().includes(query.toLowerCase())).map(b=>b.id)
  const select = (id:string) => { setSelected(id);setQuery('');setFloor(null);setExploded(false);setCaseOpen(null);setIndexOpen(false);setView('campus') }
  const reset = () => {setSelected('lhc');setZoom(1);setFocused(false);setResetKey(v=>v+1);setRotation(0);setFloor(null);setExploded(false);setKind('All buildings');setQuery('');setPeriod('All times');setDevice('All devices');setMarkers(true)}
  const nextTour = () => {const step=(tour??-1)+1;if(step>4){setTour(null);return}setTour(step);setView(step===4?'findings':'campus');if(step===1)select('mgcl');if(step===2){select('lhc');setExploded(true)}if(step===3)setPeriod('Evening')}
  const style = { '--p-bg':p.bg,'--p-surface':p.surface,'--p-ink':p.ink,'--p-muted':p.muted,'--p-border':p.border,'--p-accent':p.accent,'--p-on-accent':p.onAccent,'--p-scene':p.scene,'--p-high':p.high,'--p-medium':p.medium,'--p-radius':`${direction.radius}px`,'--p-display':`'${direction.display}', sans-serif`,'--p-body':`'${direction.body}', sans-serif`,'--p-mono':`'${direction.mono}', monospace` } as CSSProperties
  const index = <BuildingList cases={cases} selected={selected} onSelect={select} query={query} setQuery={setQuery} kind={kind} setKind={setKind} />
  const download = () => {
    const rows = ['case_id,building,floor,zone,device,count,watts,observed_at,verified_hours,kwh',...cases.map(c=>[c.id,c.buildingId,c.floor,c.zone,c.device,c.count,caseWatts(c),c.time,c.verifiedHours??'',caseEnergy(c)??''].join(','))]
    const url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='iitr-pulse-design-sample.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  return <div className="prototype direction-chromatic" style={style}>
    <a className="skip-link" href="#campus-workspace">Skip to campus workspace</a>
    <header className="prototype-header"><div className="prototype-brand"><CubeMark/><div><b>IITR Pulse<span className="brand-stop">.</span></b><span>Campus electricity audit</span></div></div><nav className="prototype-nav" aria-label="Audit views"><button data-active={view==='campus'} onClick={()=>setView('campus')}><Map size={15}/>Campus</button><button data-active={view==='findings'} onClick={()=>setView('findings')}><Grid2X2 size={15}/>Findings</button></nav><div className="prototype-header-right"><span className="sample-tag">Illustrative data</span><button className="tour-button" aria-label="Take a tour" onClick={()=>{reset();setView('campus');setTour(0)}}><span>Take a tour</span><ArrowRight size={15}/></button></div></header>
    <div className="prototype-titlebar"><div><span className="small-label">IIT Roorkee / selected audit scope</span><h1>See the campus differently.</h1></div><div className="scope-date"><span>Sample audit</span><b>14 February 2025</b><span>{campusStats.buildings} mapped / 12 in audit scope</span></div></div>
    <main id="campus-workspace" className="prototype-body" tabIndex={-1}>
      <aside className="persistent-index"><div className="district-title"><span className="small-label">Explore the campus</span><h2>Places & evidence</h2></div>{index}<div className="sidebar-caption"><FileText size={15}/><p>Every marker opens an observation.<br/>Every observation has a source.</p></div></aside>
      {view==='findings' ? <Findings cases={cases} onSelect={select}/> : <>
      <section className="model-stage" aria-label="Campus explorer">
        <div className="stage-top"><div className="stage-intro"><span className="stage-pill"><Zap size={13}/>Electricity</span><span className="stage-location">IITR / {campusStats.buildings} mapped buildings</span></div><div className="stage-actions"><button aria-label="Show building list" onClick={()=>setIndexOpen(!indexOpen)}><Search size={15}/><span>Buildings</span></button><button aria-label={markers?'Hide electricity markers':'Show electricity markers'} aria-pressed={markers} onClick={()=>setMarkers(!markers)}><Eye size={15}/></button></div></div>
        <div className="stage-summary"><div><strong>{cases.length.toString().padStart(2,'0')}</strong><span>Sample observations</span></div><div><strong>{new Set(cases.map(c=>c.buildingId)).size.toString().padStart(2,'0')}<small>/12</small></strong><span>Buildings with evidence</span></div></div>
        <div className="drawing-wrap"><CampusDrawing direction={direction} selected={selected} onSelect={select} cases={cases} visible={visible} exploded={exploded} selectedFloor={floor} zoom={zoom} rotation={rotation} markers={markers} focus={focused} resetKey={resetKey}/></div>
        <div className="district-legend"><span><i style={{background:'#5594ad'}}/>Academic</span><span><i style={{background:'#e9a099'}}/>Residences</span><span><i style={{background:'#8ab298'}}/>Common spaces</span><small>Colors indicate visual districts</small></div>
        <div className="stage-bottom"><div className="model-legend"><span><i/>Observed load</span><span><i/>No sample evidence</span></div><div className="map-controls"><button aria-label="Zoom out" disabled={zoom<=.7} onClick={()=>setZoom(v=>Math.max(.7,v/1.4))}><Minus size={15}/></button><button aria-label="Zoom in" disabled={zoom>=8} onClick={()=>setZoom(v=>Math.min(8,v*1.4))}><Plus size={15}/></button><button aria-label="Focus selected building" aria-pressed={focused} onClick={()=>{setFocused(v=>!v);setZoom(focused?1:4);setResetKey(v=>v+1)}}><Focus size={15}/></button><button aria-label="Rotate model" onClick={()=>setRotation(v=>v===12?-12:12)}><Compass size={16}/></button><button aria-label="Reset campus" onClick={reset}><RotateCcw size={14}/></button></div></div>
        {indexOpen&&<div className="index-popover"><div className="popover-top"><span>Select a building</span><button aria-label="Close building list" onClick={()=>setIndexOpen(false)}><X size={16}/></button></div>{index}</div>}
      </section>
      <aside className="prototype-inspector" aria-label="Selected building evidence"><div className="inspector-top"><span><span className="selection-dot"/>Selected building</span><button aria-label="Previous building" onClick={()=>select(campusBuildings[(campusBuildings.findIndex(b=>b.id===selected)+campusBuildings.length-1)%campusBuildings.length].id)}><ArrowLeft size={14}/></button><button aria-label="Next building" onClick={()=>select(campusBuildings[(campusBuildings.findIndex(b=>b.id===selected)+1)%campusBuildings.length].id)}><ArrowRight size={14}/></button></div>
        {building.hero&&<div className="floor-toolbar"><button className="explode-button" aria-pressed={exploded} onClick={()=>{setExploded(v=>!v);setFloor(null)}}><Layers size={14}/>{exploded?'Reassemble':'Separate floors'}</button><label><span className="sr-only">Select floor</span><select value={floor??'all'} onChange={e=>{setFloor(e.target.value==='all'?null:Number(e.target.value));setExploded(true)}}><option value="all">All floors</option>{Array.from({length:building.floors},(_,i)=><option key={i} value={i}>{floorName(i)}</option>)}</select></label></div>}
        <Evidence building={building} cases={cases} floor={floor} onCase={setCaseOpen}/>
      </aside></>}
    </main>
    <footer className="prototype-timeline"><div className="timeline-title"><Clock3 size={17}/><div><b>Recorded audit window</b><span>Filter by observation time</span></div></div><div className="timeline-periods" role="group" aria-label="Recorded audit window">{windows.map(w=><button key={w} aria-pressed={period===w} onClick={()=>setPeriod(w)}>{w}<span>{w==='Morning'?'06–12':w==='Afternoon'?'12–17':w==='Evening'?'17–21':w==='Night'?'21–24':'All records'}</span></button>)}</div><label className="device-select"><SlidersHorizontal size={14}/><span className="sr-only">Device filter</span><select value={device} onChange={e=>setDevice(e.target.value)}>{devices.map(d=><option key={d}>{d}</option>)}</select></label><button className="export-button" aria-label="Download sample observations CSV" onClick={download}><ArrowDownToLine size={15}/></button></footer>
    <div className="prototype-footnote"><span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a> / <a href="/geometry-sources.txt" target="_blank" rel="noreferrer">Shape references ↗</a></span><span>Geographic footprints. Estimated heights. Sample observations.</span></div>
    {caseOpen&&<div className="case-detail-overlay" ref={caseDialog} role="dialog" aria-modal="true" aria-label="Expanded case file"><section className="case-detail"><div className="detail-top"><span>{caseOpen.id} / Sample case file</span><button aria-label="Close case file" onClick={()=>setCaseOpen(null)}><X size={19}/></button></div><h2>{caseOpen.zone}</h2><p>{building.name} / {floorName(caseOpen.floor)}</p><div className="case-detail-load"><strong>{caseWatts(caseOpen)}<small> W</small></strong><span>Unoccupied, appliances active</span></div><dl><div><dt>Observed</dt><dd>14 Feb 2025, {caseOpen.time}</dd></div><div><dt>Device count</dt><dd>{caseOpen.count} {caseOpen.device.toLowerCase()}</dd></div><div><dt>Configured wattage</dt><dd>{caseOpen.unitWatts} W per device</dd></div><div><dt>Verification</dt><dd>{caseOpen.verification??'No verified duration'}</dd></div><div><dt>Energy estimate</dt><dd>{caseEnergy(caseOpen)===null?'Not available':`${caseEnergy(caseOpen)!.toFixed(2)} kWh`}</dd></div><div><dt>Confidence / state</dt><dd>Direct observation / sample published case</dd></div></dl><div className="intervention"><Sparkles size={18}/><p>{caseOpen.recommendation}</p></div><p className="data-note">Illustrative case for interface review.</p><button className="detail-done" onClick={()=>setCaseOpen(null)}>Back to campus <ArrowRight size={16}/></button></section></div>}
    {tour!==null&&<section className="tour-notes" aria-label="Guided tour"><div><span>{Math.max(0,tour)+1} / 5</span><button aria-label="Close guided tour" onClick={()=>setTour(null)}><X size={14}/></button></div><h3>{['Campus audit scope','Largest sample hotspot','Look between the floors','Follow the evening round','Three small interventions'][Math.max(0,tour)]}</h3><p>{['The mapped campus uses one shared geographic scale. Twelve buildings have sample audit scope; the rest are context. Drag the map or focus a building.','The library case records an AC running in an unoccupied room. The evidence supports watts, with no verified duration.','LHC separates into schematic levels. Select a floor to narrow its evidence.','The evening lens shows only the observations recorded between 17:00 and 21:00.','Start with room ownership, clear switch labels, and repeat-hotspot checks.'][Math.max(0,tour)]}</p><button onClick={nextTour}>{tour===4?'Finish tour':'Next stop'} <ArrowRight size={14}/></button></section>}
  </div>
}
