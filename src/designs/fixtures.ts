import { mappedSources } from './campusData'
import { layoutForSource, verticalPixelsPerMeter } from './buildingGeometry'
// Building placement is geographic; audit observations remain illustrative.
export type CampusBuilding = {
  id: string; short: string; name: string; kind: 'Academic' | 'Library' | 'Student life' | 'Residence' | 'Department' | 'Other';
  x: number; y: number; w: number; d: number; h: number; floors: number; hero?: boolean;
  auditScope?: boolean; named?: boolean; heightMeters?: number; heightBasis?: 'OSM height' | 'OSM levels estimate' | 'Assumed height';
}
export type Case = {
  id: string; buildingId: string; floor: number; zone: string; hour: number; time: string;
  count: number; unitWatts: number; device: 'Lights' | 'Fans' | 'AC'; verifiedHours?: number;
  verification?: string; recommendation: string;
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
const mappedBuildings: CampusBuilding[] = mappedSources.map(source=>{
  const meta=metaById.get(source.id)
  const name=meta?.name||source.sourceName||`Unnamed mapped building · ${source.id.split('-').pop()}`
  const levelTag=Number.parseFloat(source.levels??'')
  const heightTag=Number.parseFloat(source.height??'')
  const floors=meta?.floors||(Number.isFinite(levelTag)&&levelTag>0?Math.round(levelTag):1)
  const heightMeters=Number.isFinite(heightTag)&&heightTag>0?heightTag:(Number.isFinite(levelTag)&&levelTag>0?levelTag:floors)*3.6
  const kind:CampusBuilding['kind']=meta?.kind||(/department|engineering/i.test(name)?'Department':/bhawan|hostel|residential|house|apartments|dormitory/i.test(name+' '+source.buildingType)?'Residence':/library/i.test(name)?'Library':/activity|club|hall|auditorium/i.test(name)?'Student life':/college|university|school|block/i.test(name+' '+source.buildingType)?'Academic':'Other')
  return {id:source.id,name,short:meta?.short||(source.id==='osm-relation-8255183'?'MAIN':source.id==='osm-way-1080933906'?'LHC-II':source.sourceName?source.sourceName.split(/\s+/).slice(0,4).map(s=>s[0]).join('').toUpperCase():'OSM'),kind,floors,hero:meta?.hero,auditScope:!!meta,named:!!source.sourceName,heightMeters,heightBasis:Number.isFinite(heightTag)&&heightTag>0?'OSM height':Number.isFinite(levelTag)&&levelTag>0?'OSM levels estimate':'Assumed height',h:heightMeters*verticalPixelsPerMeter,...layoutForSource(source)}
})
export const auditBuildings=auditMetadata.map(meta=>mappedBuildings.find(b=>b.id===meta.id)!)
export const campusBuildings=[...auditBuildings,...mappedBuildings.filter(b=>!b.auditScope).sort((a,b)=>Number(b.named)-Number(a.named)||a.name.localeCompare(b.name))]
export const demoCases: Case[] = [
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
export const caseWatts = (c: Case) => c.count * c.unitWatts
export const caseEnergy = (c: Case) => c.verifiedHours !== undefined ? caseWatts(c) * c.verifiedHours / 1000 : null
export const loadFor = (id: string, cases = demoCases) => cases.filter(c => c.buildingId === id).reduce((sum, c) => sum + caseWatts(c), 0)
export const campusTotal = demoCases.reduce((sum, c) => sum + caseWatts(c), 0)
export const verifiedTotal = demoCases.reduce((sum, c) => sum + (caseEnergy(c) ?? 0), 0)
export const number = (value: number) => new Intl.NumberFormat('en-IN').format(value)
export const floorName = (floor: number) => floor === 0 ? 'Ground floor' : `Level ${floor}`
