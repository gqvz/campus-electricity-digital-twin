import { mappedSources } from './campusData'
import { layoutForSource, metersPerSceneUnit, verticalPixelsPerMeter } from './buildingGeometry'
// Building placement is geographic; audit observations remain illustrative.
export type CampusBuilding = {
  id: string; short: string; name: string; kind: 'Academic' | 'Library' | 'Student life' | 'Residence' | 'Department' | 'Other';
  x: number; y: number; w: number; d: number; h: number; floors: number; hero?: boolean;
  auditScope?: boolean; named?: boolean; heightMeters?: number; heightBasis?: 'OSM height' | 'OSM levels estimate' | 'Assumed height' | 'Photo-based estimate';
}
export type Case = {
  id: string; buildingId: string; floor: number; zone: string; hour: number; time: string;
  count: number; unitWatts: number; device: 'Lights' | 'Fans' | 'AC' | 'Other'; verifiedHours?: number;
  verification?: string; recommendation: string;
  occupied?: boolean; confidence?: 'direct' | 'inferred'; observedOn?: string   // ISO date; absent in demo fixtures
}
const auditMetadata: Omit<CampusBuilding,'x'|'y'|'w'|'d'|'h'>[] = [
  { id:'lhc', short:'LHC', name:'Lecture Hall Complex', kind:'Academic', floors:4, hero:true },
  { id:'mgcl', short:'MGCL', name:'Mahatma Gandhi Central Library', kind:'Library', floors:4, hero:true },
  { id:'mac', short:'MAC', name:'Multi Activity Centre', kind:'Student life', floors:4, hero:true },
  { id:'sac', short:'SAC', name:'Students Activity Centre', kind:'Student life', floors:4, hero:true },
  { id:'rajendra', short:'RB', name:'Rajendra Bhawan', kind:'Residence', floors:3 },
  { id:'ravindra', short:'RAV', name:'Ravindra Bhawan', kind:'Residence', floors:3 },
  { id:'cautley', short:'CB', name:'Cautley Bhawan', kind:'Residence', floors:3 },
  { id:'govind', short:'GB', name:'Govind Bhawan', kind:'Residence', floors:3 },
  { id:'civil', short:'CE', name:'Civil Engineering', kind:'Department', floors:3 },
  { id:'electrical', short:'EE', name:'Electrical Engineering', kind:'Department', floors:3 },
  { id:'ece', short:'ECE', name:'Electronics & Communication', kind:'Department', floors:4 },
  { id:'mechanical', short:'ME', name:'Mechanical Engineering', kind:'Department', floors:3 },
]
const metaById=new Map(auditMetadata.map(b=>[b.id,b]))
// Heights read from street-level photographs (see docs/building-research.txt); approximate, not surveyed.
const photoEstimates: Record<string,{heightMeters:number;floors:number}> = {
  'osm-relation-8255183': { heightMeters: 12.6, floors: 2 },
  mgcl: { heightMeters: 17, floors: 4 },
  // Opened 2025; eight terraced levels read from the place photo, not surveyed.
  'vivekananda-bhawan': { heightMeters: 27, floors: 8 },
}
const mappedBuildings: CampusBuilding[] = mappedSources.map(source=>{
  const meta=metaById.get(source.id)
  const name=meta?.name||source.sourceName||`Unnamed mapped building · ${source.id.split('-').pop()}`
  const levelTag=Number.parseFloat(source.levels??'')
  const heightTag=Number.parseFloat(source.height??'')
  const photo=photoEstimates[source.id]
  const floors=photo?.floors||meta?.floors||(Number.isFinite(levelTag)&&levelTag>0?Math.round(levelTag):1)
  const heightMeters=photo?.heightMeters??(Number.isFinite(heightTag)&&heightTag>0?heightTag:(Number.isFinite(levelTag)&&levelTag>0?levelTag:floors)*3.6)
  const kind:CampusBuilding['kind']=meta?.kind||(/department|engineering/i.test(name)?'Department':/bhawan|hostel|residential|house|apartments|dormitory/i.test(name+' '+source.buildingType)?'Residence':/library/i.test(name)?'Library':/activity|club|hall|auditorium/i.test(name)?'Student life':/college|university|school|block/i.test(name+' '+source.buildingType)?'Academic':'Other')
  return {id:source.id,name,short:meta?.short||(source.id==='vivekananda-bhawan'?'VB':source.id==='osm-relation-8255183'?'MAIN':source.id==='osm-way-1080933906'?'LHC-II':source.sourceName?source.sourceName.split(/\s+/).slice(0,4).map(s=>s[0]).join('').toUpperCase():'OSM'),kind,floors,hero:meta?.hero,auditScope:true,named:!!source.sourceName,heightMeters,heightBasis:photo?'Photo-based estimate':Number.isFinite(heightTag)&&heightTag>0?'OSM height':Number.isFinite(levelTag)&&levelTag>0?'OSM levels estimate':'Assumed height',h:heightMeters*verticalPixelsPerMeter,...layoutForSource(source)}
})
export const auditBuildings=auditMetadata.map(meta=>mappedBuildings.find(b=>b.id===meta.id)!)
export const campusBuildings=[...auditBuildings,...mappedBuildings.filter(b=>!metaById.has(b.id)).sort((a,b)=>Number(b.named)-Number(a.named)||a.name.localeCompare(b.name))]
const handCases: Case[] = [
  { id: 'P-001', buildingId: 'lhc', floor: 1, zone: 'Classroom B-201', time: '20:35', hour: 20, count: 8, unitWatts: 65, device: 'Fans', verifiedHours: 1.5, verification: 'Shutdown confirmed at 22:05', recommendation: 'Assign a switch-off check after the last class.' },
  { id: 'P-002', buildingId: 'lhc', floor: 1, zone: 'Classroom B-201', time: '20:35', hour: 20, count: 12, unitWatts: 20, device: 'Lights', verifiedHours: 1.5, verification: 'Shutdown confirmed at 22:05', recommendation: 'Place a switch-off reminder beside the classroom exit.' },
  { id: 'P-003', buildingId: 'lhc', floor: 0, zone: 'South corridor', time: '18:10', hour: 18, count: 8, unitWatts: 20, device: 'Lights', recommendation: 'Check daylight levels before switching on the full corridor.' },
  { id: 'P-004', buildingId: 'mgcl', floor: 2, zone: 'Reading room 2', time: '21:15', hour: 21, count: 1, unitWatts: 1200, device: 'AC', recommendation: 'Add room close-down ownership to the evening checklist.' },
  { id: 'P-005', buildingId: 'sac', floor: 0, zone: 'Meeting room', time: '18:40', hour: 18, count: 4, unitWatts: 65, device: 'Fans', recommendation: 'Label the fan switches near the meeting room door.' },
  { id: 'P-006', buildingId: 'rajendra', floor: 0, zone: 'Common room', time: '22:05', hour: 22, count: 4, unitWatts: 65, device: 'Fans', verifiedHours: .5, verification: 'Shutdown confirmed at 22:35', recommendation: 'Make common-room close-down a nightly shared responsibility.' },
  { id: 'P-007', buildingId: 'ravindra', floor: 1, zone: 'Study room', time: '22:20', hour: 22, count: 6, unitWatts: 20, device: 'Lights', recommendation: 'Place the last-person-out reminder next to the exit.' },
  { id: 'P-008', buildingId: 'cautley', floor: 0, zone: 'East corridor', time: '09:15', hour: 9, count: 5, unitWatts: 20, device: 'Lights', recommendation: 'Review corridor lighting during bright daylight.' },
  { id: 'P-009', buildingId: 'electrical', floor: 0, zone: 'Tutorial room', time: '14:30', hour: 14, count: 3, unitWatts: 65, device: 'Fans', recommendation: 'Include appliance checks in the room handover.' },
  { id: 'P-010', buildingId: 'ece', floor: 1, zone: 'Seminar room', time: '18:30', hour: 18, count: 5, unitWatts: 20, device: 'Lights', verifiedHours: 1, verification: 'Shutdown confirmed at 19:30', recommendation: 'Add a closing checklist after seminars.' },
]
// Illustrative sample sightings for every mapped building, scaled by floor area (footprint x floors).
// Deterministic (seeded by building id) so the demo is stable between loads. Not real observations.
const hashSeed=(text:string)=>{let h=2166136261;for(const ch of text){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
const seededRandom=(seed:number)=>()=>{seed=(seed+0x6D2B79F5)>>>0;let t=seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}
const zonesByKind:Record<CampusBuilding['kind'],string[]>={
  Academic:['Classroom','Tutorial room','Seminar room','Corridor'],Library:['Reading room','Stack aisle','Discussion room','Corridor'],
  'Student life':['Meeting room','Club room','Hall','Corridor'],Residence:['Common room','Study room','Corridor','Mess hall'],
  Department:['Lab','Faculty room','Tutorial room','Corridor'],Other:['Office','Store room','Corridor'],
}
const deviceMix:{device:Case['device'];unitWatts:number;perSqm:number;weight:number}[]=[
  {device:'Lights',unitWatts:20,perSqm:1/12,weight:.5},{device:'Fans',unitWatts:65,perSqm:1/25,weight:.35},
  {device:'AC',unitWatts:1200,perSqm:1/180,weight:.1},{device:'Other',unitWatts:100,perSqm:1/80,weight:.05},
]
const sampleHours=[9,11,14,18,19,20,21,22]
const pad2=(v:number)=>String(v).padStart(2,'0')
const generateCases=(buildings:CampusBuilding[]):Case[]=>buildings.flatMap(b=>{
  const rand=seededRandom(hashSeed(b.id))
  const floorArea=Math.max(40,b.w*b.d*metersPerSceneUnit*metersPerSceneUnit*b.floors*.6)  // bounding box overstates the plan
  const n=Math.min(8,Math.max(1,Math.round(Math.sqrt(floorArea)/22)))
  return Array.from({length:n},(_,i):Case=>{
    let pick=rand(),mix=deviceMix[0]
    for(const m of deviceMix){if(pick<m.weight){mix=m;break}pick-=m.weight}
    const zones=zonesByKind[b.kind]
    const zoneArea=floorArea/b.floors/(3+rand()*4)   // one zone is a few of the floor's rooms
    const count=Math.max(1,Math.round(zoneArea*mix.perSqm*(.4+rand()*.6)))
    const hour=sampleHours[Math.floor(rand()*sampleHours.length)],minute=Math.floor(rand()*12)*5
    const verified=rand()<.3
    const extra=verified?Math.round((.5+rand()*1.5)*12)*5:0   // minutes, 5-minute steps
    const closeAt=hour*60+minute+extra
    return {
      id:`G-${b.id.replace(/^osm-/,'')}-${i+1}`,buildingId:b.id,floor:Math.floor(rand()*b.floors),
      zone:`${zones[Math.floor(rand()*zones.length)]} ${String.fromCharCode(65+Math.floor(rand()*4))}-${100*(1+Math.floor(rand()*b.floors))+1+Math.floor(rand()*20)}`,
      time:`${pad2(hour)}:${pad2(minute)}`,hour,count,unitWatts:mix.unitWatts,device:mix.device,
      ...(verified?{verifiedHours:extra/60,verification:`Shutdown confirmed at ${pad2(Math.floor(closeAt/60)%24)}:${pad2(closeAt%60)}`}:{}),
      recommendation:mix.device==='AC'?'Add room close-down ownership to the closing checklist.':'Place a switch-off reminder beside the exit.',
    }
  })
})
export const demoCases: Case[] = [...handCases, ...generateCases(campusBuildings)]
export const caseWatts = (c: Case) => c.count * c.unitWatts
export const caseEnergy = (c: Case) => c.verifiedHours !== undefined ? caseWatts(c) * c.verifiedHours / 1000 : null
export const loadFor = (id: string, cases = demoCases) => cases.filter(c => c.buildingId === id).reduce((sum, c) => sum + caseWatts(c), 0)
export const campusTotal = demoCases.reduce((sum, c) => sum + caseWatts(c), 0)
export const verifiedTotal = demoCases.reduce((sum, c) => sum + (caseEnergy(c) ?? 0), 0)
export const number = (value: number) => new Intl.NumberFormat('en-IN').format(value)
export const floorName = (floor: number) => floor === 0 ? 'Ground floor' : `Level ${floor}`
