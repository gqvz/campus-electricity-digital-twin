import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { campusBuildings, floorName, number } from '../designs/fixtures'
import { supabase } from '../data/supabase'
import { useAuth } from '../data/useAuth'
import { PageShell } from './PageShell'

type Photo = { id: string; storage_path: string; public_path: string | null; sanitized: boolean; url?: string }
type Row = {
  id: string; building_id: string; floor: number; zone_name: string; device: string; device_count: number; unit_watts: number
  watts: number; kwh: number | null; occupied: boolean; observed_at: string; verified_hours: number | null; confidence: string
  recommendation: string | null; private_notes: string | null; state: string; submitted_at: string | null; evidence_photos: Photo[]
}

export function ReviewPage() {
  const auth = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const client = supabase()

  const load = useCallback(async () => {
    if (!client) return
    const { data, error } = await client.from('observations')
      .select('id, building_id, floor, zone_name, device, device_count, unit_watts, watts, kwh, occupied, observed_at, verified_hours, confidence, recommendation, private_notes, state, submitted_at, evidence_photos(id, storage_path, public_path, sanitized)')
      .or('and(state.eq.draft,submitted_at.not.is.null),state.eq.reviewed,state.eq.published').order('observed_at', { ascending: false }).limit(100)
    if (error) { setError(error.message); return }
    const list = (data ?? []) as unknown as Row[]
    const paths = list.flatMap(r => r.evidence_photos.map(p => p.storage_path))
    if (paths.length) {
      const { data: signed } = await client.storage.from('evidence').createSignedUrls(paths, 600)
      const map = new Map((signed ?? []).map(s => [s.path, s.signedUrl]))
      list.forEach(r => r.evidence_photos.forEach(p => { p.url = map.get(p.storage_path) ?? undefined }))
    }
    setError(null); setRows(list)
  }, [client])
  useEffect(() => { if (auth.isReviewer) void load() }, [auth.isReviewer, load])

  if (!auth.configured) return <PageShell title="Review"><p className="page-note" role="status">Review needs the live backend, which is not configured in this build.</p></PageShell>
  if (auth.loading) return <PageShell title="Review"><p className="page-note" role="status">Checking your session…</p></PageShell>
  if (!auth.session) return <Navigate to="/login" replace />
  if (!auth.isReviewer) return <PageShell title="Review"><p className="page-note" role="status">Only reviewers can open this page.</p></PageShell>

  const act = async (id: string, fn: () => Promise<{ error: { message: string } | null }>) => {
    setBusy(id); const { error } = await fn(); setBusy(null)
    if (error) setError(error.message); else { setError(null); await load() }
  }
  const setState = (id: string, state: string, extra: object = {}) => act(id, async () => await client!.from('observations').update({ state, ...extra }).eq('id', id))
  const sanitize = (photo: Photo, obsId: string) => act(obsId, async () => {
    const dest = `${obsId}/${photo.id}.jpg`
    const copy = await client!.storage.from('evidence').copy(photo.storage_path, dest, { destinationBucket: 'evidence-public' })
    if (copy.error) return { error: copy.error }
    return await client!.from('evidence_photos').update({ sanitized: true, public_path: dest }).eq('id', photo.id)
  })

  return <PageShell title="Review queue" lead="Check each observation against the method before it becomes public. Publishing is blocked while any attached photo is unchecked.">
    {error && <p className="field-error" role="alert">{error}</p>}
    {rows.length === 0 ? <p className="page-note" role="status">Nothing waiting for review.</p> :
    <ul className="review-list">{rows.map(r => {
      const b = campusBuildings.find(x => x.id === r.building_id)
      return <li key={r.id} className="page-card review-card">
        <div className="review-head"><b>{b?.name ?? r.building_id}</b><span className="badge" data-state={r.state}>{r.state}</span></div>
        <p>{floorName(r.floor)} · {r.zone_name} · {r.device_count} × {r.device} @ {r.unit_watts} W = <b>{number(r.watts)} W</b>
          {r.kwh != null ? <> · <b>{Number(r.kwh).toFixed(2)} kWh</b> over {r.verified_hours} h</> : <> · no verified duration</>}</p>
        <p className="page-meta">{new Date(r.observed_at).toLocaleString('en-IN')} · {r.occupied ? 'occupied' : 'unoccupied'} · {r.confidence}</p>
        {r.recommendation && <p>Suggested: {r.recommendation}</p>}
        {r.private_notes && <p className="page-meta">Private note: {r.private_notes}</p>}
        {r.evidence_photos.map(p => <div key={p.id} className="photo-row">
          {p.url && <img src={p.url} alt="Evidence photo awaiting check" loading="lazy" />}
          {p.sanitized ? <span className="badge" data-state="published">checked for publication</span> :
            <button className="btn" disabled={busy === r.id} onClick={() => sanitize(p, r.id)}>No faces, screens or IDs: approve photo</button>}
        </div>)}
        <div className="actions">
          {r.state === 'draft' && <button className="btn primary" disabled={busy === r.id} onClick={() => setState(r.id, 'reviewed')}>Approve</button>}
          {r.state === 'reviewed' && <>
            <button className="btn" disabled={busy === r.id} onClick={() => setState(r.id, 'draft', { submitted_at: null })}>Return to author</button>
            <button className="btn primary" disabled={busy === r.id} onClick={() => setState(r.id, 'published')}>Publish</button></>}
          {r.state === 'published' && <button className="btn" disabled={busy === r.id} onClick={() => setState(r.id, 'resolved')}>Mark resolved</button>}
        </div>
      </li>
    })}</ul>}
  </PageShell>
}
