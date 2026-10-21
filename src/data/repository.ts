import { demoCases } from '../designs/fixtures'
import type { Case } from '../designs/fixtures'
import { liveMode, timeZone } from './config'
import { supabase } from './supabase'

export type CaseSource = { mode: 'demo' | 'live'; cases: Case[]; updatedAt: string | null; observationCount: number }

const deviceLabel: Record<string, Case['device']> = { lights: 'Lights', fans: 'Fans', ac: 'AC', other: 'Other' }

const clock = (iso: string) => new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))

type PublicRow = {
  id: string; building_id: string; floor: number; zone_name: string; device: string; device_count: number
  unit_watts: number; occupied: boolean; confidence: string; observed_at: string; verified_at: string | null; verified_hours: number | string | null
  recommendation: string | null; published_at: string | null
}

export function rowToCase(r: PublicRow): Case {
  const time = clock(r.observed_at)
  const hours = r.verified_hours == null ? undefined : Number(r.verified_hours)
  return {
    id: r.id.slice(0, 8).toUpperCase(), buildingId: r.building_id, floor: r.floor, zone: r.zone_name,
    hour: Number(time.slice(0, 2)), time, count: r.device_count, unitWatts: r.unit_watts,
    device: deviceLabel[r.device] ?? 'Other',
    occupied: r.occupied, confidence: r.confidence === 'inferred' ? 'inferred' : 'direct',
    observedOn: new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(r.observed_at)),
    verifiedHours: hours,
    verification: r.verified_at && hours ? `Shutdown confirmed at ${clock(r.verified_at)}` : undefined,
    recommendation: r.recommendation ?? '',
  }
}

export async function loadCases(): Promise<CaseSource> {
  const client = supabase()
  if (!liveMode || !client) return { mode: 'demo', cases: demoCases, updatedAt: null, observationCount: demoCases.length }
  const { data, error } = await client.from('public_observations').select('*').order('observed_at', { ascending: false }).limit(2000)
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as PublicRow[]
  const updatedAt = (rows.map(r => r.published_at).filter(Boolean) as string[]).sort().pop() ?? null
  return { mode: 'live', cases: rows.map(rowToCase), updatedAt, observationCount: rows.length }
}
