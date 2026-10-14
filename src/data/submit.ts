import { supabase } from './supabase'
import { toRow } from './observation'
import type { ObservationInput } from './observation'
import { downscaleImage } from './image'
import { listQueue, queueObservation, removeQueued } from './drafts'

const SESSION_KEY = 'pulse:audit-session'
const SESSION_TTL = 6 * 3_600_000

async function currentSession(): Promise<string> {
  const client = supabase()
  if (!client) throw new Error('Not connected')
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null') as { id: string; at: number } | null
    if (saved && Date.now() - saved.at < SESSION_TTL) return saved.id
  } catch { /* fall through */ }
  const { data, error } = await client.from('audit_sessions').insert({ started_at: new Date().toISOString() }).select('id').single()
  if (error) throw new Error(error.message)
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: data.id, at: Date.now() }))
  return data.id
}

/** Send one observation (and its photo) to Supabase as a draft; `submit` flags it for review. */
export async function sendObservation(input: ObservationInput, photo: Blob | undefined, submit: boolean) {
  const client = supabase()
  if (!client) throw new Error('Not connected')
  const { data: u } = await client.auth.getUser()
  if (!u.user) throw new Error('Sign in first')
  const sessionId = await currentSession()
  const row = { ...toRow(input, sessionId), submitted_at: submit ? new Date().toISOString() : null }
  const { data, error } = await client.from('observations').insert(row).select('id').single()
  if (error) throw new Error(error.message)
  if (photo) {
    const path = `${u.user.id}/${data.id}/${crypto.randomUUID()}.jpg`
    const up = await client.storage.from('evidence').upload(path, await downscaleImage(photo), { contentType: 'image/jpeg' })
    if (up.error) throw new Error(up.error.message)
    const link = await client.from('evidence_photos').insert({ observation_id: data.id, storage_path: path })
    if (link.error) throw new Error(link.error.message)
  }
  return data.id as string
}

/** Try now; if offline or failing, keep it on this device and retry later. */
export async function saveOrQueue(input: ObservationInput, photo: Blob | undefined, submit: boolean): Promise<'sent' | 'queued'> {
  if (navigator.onLine) {
    try { await sendObservation(input, photo, submit); return 'sent' } catch (e) {
      if (e instanceof Error && /sign in|jwt|row-level/i.test(e.message)) throw e   // not a connectivity problem
    }
  }
  await queueObservation({ input, photo, submit })
  return 'queued'
}

export async function flushQueue(): Promise<{ sent: number; left: number }> {
  let sent = 0
  for (const item of await listQueue()) {
    try { await sendObservation(item.input, item.photo, item.submit); await removeQueued(item.localId); sent++ } catch { /* keep for next time */ }
  }
  return { sent, left: (await listQueue()).length }
}
