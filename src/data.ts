export type Building = {
  id: string; name: string; short: string; type: string; status: string; floors: number; x: number; z: number; w: number; d: number; color: string; load: number; audits: number
}

export type Observation = {
  id: string; buildingId: string; room: string; time: string; device: string; count: number; watts: number; occupancy: string; confidence: string; note: string; recommendation: string; duration?: number
}

export const buildings: Building[] = [
  { id: 'lhc', name: 'Learning Resource Centre', short: 'LHC', type: 'Academic · Hero building', status: 'Priority review', floors: 4, x: -1.5, z: -0.6, w: 4.4, d: 2.2, color: '#b9a58a', load: 890, audits: 18 },
  { id: 'mgcl', name: 'Mahatma Gandhi Central Library', short: 'MGCL', type: 'Library · Hero building', status: 'Partially audited', floors: 5, x: 4.4, z: -1.4, w: 3.4, d: 2.3, color: '#718692', load: 430, audits: 9 },
  { id: 'mac', name: 'Multi Activity Centre', short: 'MAC', type: 'Common area · Hero building', status: 'Not audited', floors: 2, x: 3.2, z: 3.0, w: 3.5, d: 2.2, color: '#7d8593', load: 180, audits: 0 },
  { id: 'sac', name: 'Students Activity Centre', short: 'SAC', type: 'Common area · Hero building', status: 'Partially audited', floors: 3, x: -3.8, z: 3.1, w: 3.6, d: 2.0, color: '#938b7c', load: 260, audits: 5 },
  { id: 'rajendra', name: 'Rajendra Bhawan', short: 'RB', type: 'Hostel · Context', status: 'Audited', floors: 6, x: -6.2, z: -2.5, w: 2.0, d: 1.7, color: '#697784', load: 210, audits: 4 },
  { id: 'ravindra', name: 'Ravindra Bhawan', short: 'RAV', type: 'Hostel · Context', status: 'Audited', floors: 5, x: -6.0, z: 1.0, w: 1.8, d: 1.6, color: '#697784', load: 140, audits: 3 },
  { id: 'cautley', name: 'Cautley Bhawan', short: 'CB', type: 'Hostel · Context', status: 'Audited', floors: 4, x: 6.0, z: 0.7, w: 1.8, d: 1.6, color: '#697784', load: 120, audits: 2 },
  { id: 'civil', name: 'Civil Engineering Department', short: 'CED', type: 'Department · Context', status: 'Not audited', floors: 3, x: 7.0, z: 3.4, w: 2.1, d: 1.5, color: '#62717d', load: 85, audits: 0 },
]

export const observations: Observation[] = [
  { id: 'OBS-042', buildingId: 'lhc', room: 'Classroom Cluster B', time: '20:35', device: 'Ceiling fans + tube lights', count: 20, watts: 890, duration: 3, occupancy: 'Unoccupied', confidence: 'Observed', note: 'Eight fans and twelve tube lights active after the final class. Doors were secured and no occupants were present.', recommendation: 'Add end-of-class switch-off checklist at cluster exits.' },
  { id: 'OBS-038', buildingId: 'lhc', room: 'South corridor', time: '18:10', device: 'Tube lights', count: 8, watts: 240, duration: 2, occupancy: 'Low occupancy', confidence: 'Observed', note: 'Corridor lighting remained at full output after daylight levels had dropped below normal circulation levels.', recommendation: 'Pilot occupancy-linked corridor lighting.' },
  { id: 'OBS-031', buildingId: 'mgcl', room: 'Reading room 2', time: '21:15', device: 'Air conditioners', count: 2, watts: 520, occupancy: 'Unoccupied', confidence: 'Observed', note: 'Two split AC units were running in a closed reading room during the evening round.', recommendation: 'Place a close-down ownership tag on each reading room.' },
  { id: 'OBS-021', buildingId: 'rajendra', room: 'Common room', time: '22:05', device: 'Television + fans', count: 5, watts: 310, occupancy: 'Unoccupied', confidence: 'Observed', note: 'Common room was empty but AV equipment and fans were left on.', recommendation: 'Assign nightly common-room close-down to floor representative.' },
]

export const getBuilding = (id: string) => buildings.find((building) => building.id === id) ?? buildings[0]
export const getObservations = (buildingId: string) => observations.filter((observation) => observation.buildingId === buildingId)
export const calculateVerifiedEnergy = (watts: number, hours?: number) => hours && hours > 0 ? (watts * hours) / 1000 : null
