import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Navigate } from 'react-router-dom'
import { Camera, CloudOff, Send, Save } from 'lucide-react'
import { campusBuildings, floorName, number } from '../designs/fixtures'
import { kwh, verifiedHoursBetween, watts } from '../data/calc'
import { deviceOptions, observationSchema } from '../data/observation'
import type { ObservationInput } from '../data/observation'
import { flushQueue, saveOrQueue } from '../data/submit'
import { listQueue } from '../data/drafts'
import { supabase } from '../data/supabase'
import { useAuth } from '../data/useAuth'
import { PageShell } from './PageShell'

const localNow = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
type Mine = { id: string; building_id: string; zone_name: string; watts: number; state: string; submitted_at: string | null; observed_at: string }

export function AuditPage() {
  const auth = useAuth()
  if (!auth.configured) return <PageShell title="Audit entry" lead="Field entry is part of the live build."><p className="page-note" role="status">This build is running in demo mode: no backend is configured, so observations cannot be saved. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to enable it.</p></PageShell>
  if (auth.loading) return <PageShell title="Audit entry"><p className="page-note" role="status">Checking your session…</p></PageShell>
  if (!auth.session) return <Navigate to="/login" replace />
  if (!auth.isTeam) return <PageShell title="Audit entry"><p className="page-note" role="status">This account is not on the team list yet. Ask a project admin to add you.</p></PageShell>
  return <AuditForm name={auth.displayName ?? auth.session.user.email ?? 'you'} reviewer={auth.isReviewer} onSignOut={auth.signOut} />
}

function AuditForm({ name, reviewer, onSignOut }: { name: string; reviewer: boolean; onSignOut: () => void }) {
  const { register, handleSubmit, watch, setValue, reset, formState: { errors, isSubmitting, dirtyFields } } = useForm<ObservationInput>({
    resolver: zodResolver(observationSchema) as never,
    defaultValues: { buildingId: '', floor: 0, zoneName: '', device: 'lights', deviceCount: 1, unitWatts: 20, occupied: false, observedAt: localNow(), verifiedAt: '', confidence: 'direct', recommendation: '', privateNotes: '' },
  })
  const [photo, setPhoto] = useState<File | undefined>()
  const [notice, setNotice] = useState<{ kind: 'ok' | 'warn' | 'err'; text: string } | null>(null)
  const [queued, setQueued] = useState(0)
  const [mine, setMine] = useState<Mine[]>([])
  const v = watch()
  const building = campusBuildings.find(b => b.id === v.buildingId)

  const refresh = useCallback(async () => {
    setQueued((await listQueue()).length)
    const { data } = await supabase()!.from('observations').select('id, building_id, zone_name, watts, state, submitted_at, observed_at').order('created_at', { ascending: false }).limit(8)
    setMine((data ?? []) as Mine[])
  }, [])
  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    const sync = async () => { const r = await flushQueue(); if (r.sent) setNotice({ kind: 'ok', text: `${r.sent} saved observation${r.sent > 1 ? 's' : ''} sent now that you are online.` }); void refresh() }
    window.addEventListener('online', sync); void sync()
    return () => window.removeEventListener('online', sync)
  }, [refresh])
  useEffect(() => { // default wattage follows the device type until the auditor edits it
    if (!dirtyFields.unitWatts) setValue('unitWatts', deviceOptions.find(d => d.value === v.device)!.defaultWatts)
  }, [v.device, dirtyFields.unitWatts, setValue])

  const w = Number.isFinite(+v.deviceCount * +v.unitWatts) ? watts(+v.deviceCount, +v.unitWatts) : 0
  const hours = v.verifiedAt ? verifiedHoursBetween(new Date(v.observedAt), new Date(v.verifiedAt)) : null
  const energy = kwh(w, hours)
  const floors = useMemo(() => Array.from({ length: building?.floors ?? 1 }, (_, i) => i), [building])

  const send = (submit: boolean) => handleSubmit(async values => {
    setNotice(null)
    try {
      const result = await saveOrQueue(values, photo, submit)
      setNotice(result === 'sent'
        ? { kind: 'ok', text: submit ? 'Submitted for review.' : 'Saved as a draft.' }
        : { kind: 'warn', text: 'No connection: saved on this device and it will send automatically when you are back online.' })
      reset({ ...values, zoneName: '', verifiedAt: '', recommendation: '', privateNotes: '', observedAt: localNow() })
      setPhoto(undefined); void refresh()
    } catch (e) { setNotice({ kind: 'err', text: e instanceof Error ? e.message : 'Could not save' }) }
  })

  const auditFirst = [...campusBuildings].sort((a, b) => Number(!!b.auditScope) - Number(!!a.auditScope))
  return <PageShell title="Audit entry" lead="Record what you can see right now. Fewer, accurate observations beat many guesses."
    actions={<>{reviewer && <a className="header-link" href="/review">Review</a>}<button className="header-link as-button" onClick={onSignOut}>Sign out</button></>}>
    <p className="page-meta">Signed in as {name}. Drafts are private until a second team member reviews and publishes them.</p>
    {queued > 0 && <p className="page-note warn" role="status"><CloudOff size={14} aria-hidden="true" /> {queued} observation{queued > 1 ? 's' : ''} waiting on this device to send.</p>}
    {notice && <p className={`page-note ${notice.kind}`} role={notice.kind === 'err' ? 'alert' : 'status'}>{notice.text}</p>}
    <form className="page-card form-grid" noValidate onSubmit={e => e.preventDefault()}>
      <label className="field wide"><span>Building</span>
        <select {...register('buildingId')} aria-invalid={!!errors.buildingId}>
          <option value="">Choose…</option>
          <optgroup label="Audit scope">{auditFirst.filter(b => b.auditScope).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</optgroup>
          <optgroup label="Other mapped buildings">{auditFirst.filter(b => !b.auditScope).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</optgroup>
        </select>
        {errors.buildingId && <em className="field-error">{errors.buildingId.message}</em>}
      </label>
      <label className="field"><span>Floor</span>
        <select {...register('floor', { valueAsNumber: true })}>{floors.map(f => <option key={f} value={f}>{floorName(f)}</option>)}</select>
      </label>
      <label className="field"><span>Room or zone</span>
        <input {...register('zoneName')} placeholder="e.g. Classroom B-201" aria-invalid={!!errors.zoneName} />
        {errors.zoneName && <em className="field-error">{errors.zoneName.message}</em>}
      </label>
      <label className="field"><span>Device</span>
        <select {...register('device')}>{deviceOptions.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select>
      </label>
      <label className="field"><span>How many on</span>
        <input type="number" inputMode="numeric" min={1} {...register('deviceCount', { valueAsNumber: true })} aria-invalid={!!errors.deviceCount} />
        {errors.deviceCount && <em className="field-error">{errors.deviceCount.message}</em>}
      </label>
      <label className="field"><span>Watts each</span>
        <input type="number" inputMode="numeric" min={1} {...register('unitWatts', { valueAsNumber: true })} aria-invalid={!!errors.unitWatts} />
        {errors.unitWatts && <em className="field-error">{errors.unitWatts.message}</em>}
      </label>
      <label className="field"><span>Seen at</span>
        <input type="datetime-local" {...register('observedAt')} aria-invalid={!!errors.observedAt} />
        {errors.observedAt && <em className="field-error">{errors.observedAt.message}</em>}
      </label>
      <label className="field check"><input type="checkbox" {...register('occupied')} /><span>Someone was in the space</span></label>
      <label className="field wide"><span>Later check: when was it switched off? <small>optional. Enables kWh, which assumes it stayed on from your sighting until then</small></span>
        <input type="datetime-local" {...register('verifiedAt')} aria-invalid={!!errors.verifiedAt} />
        {errors.verifiedAt && <em className="field-error">{errors.verifiedAt.message}</em>}
      </label>
      <fieldset className="field wide"><legend>How sure are you?</legend>
        <label className="radio"><input type="radio" value="direct" {...register('confidence')} /> Saw it directly</label>
        <label className="radio"><input type="radio" value="inferred" {...register('confidence')} /> Inferred</label>
      </fieldset>
      <label className="field wide"><span>Suggested fix <small>optional</small></span>
        <input {...register('recommendation')} placeholder="e.g. Put a switch-off reminder by the door" />
      </label>
      <label className="field wide"><span>Private note <small>never published</small></span>
        <textarea rows={2} {...register('privateNotes')} />
      </label>
      <label className="field wide"><span><Camera size={14} aria-hidden="true" /> Photo <small>optional, avoid faces and screens</small></span>
        <input type="file" accept="image/*" capture="environment" onChange={e => setPhoto(e.target.files?.[0])} />
        {photo && <small>{photo.name}. It is re-encoded on your device to remove location data before upload.</small>}
      </label>
      <div className="readout wide" aria-live="polite">
        <div><b>{number(w)} W</b><span>avoidable load</span></div>
        <div><b>{energy === null ? 'No duration' : `${energy.toFixed(2)} kWh`}</b><span>{energy === null ? 'a single sighting is not energy' : `over ${hours} h verified`}</span></div>
      </div>
      <div className="actions wide">
        <button type="button" className="btn" disabled={isSubmitting} onClick={send(false)}><Save size={15} aria-hidden="true" /> Save draft</button>
        <button type="button" className="btn primary" disabled={isSubmitting} onClick={send(true)}><Send size={15} aria-hidden="true" /> Submit for review</button>
      </div>
    </form>
    <h2 className="page-h2">Your recent observations</h2>
    {mine.length === 0 ? <p className="page-note">Nothing yet.</p> : <ul className="mine-list">
      {mine.map(o => <li key={o.id}><span><b>{campusBuildings.find(b => b.id === o.building_id)?.name ?? o.building_id}</b> · {o.zone_name}</span>
        <span>{number(o.watts)} W</span><span className="badge" data-state={o.state === 'draft' && o.submitted_at ? 'submitted' : o.state}>{o.state === 'draft' && o.submitted_at ? 'awaiting review' : o.state}</span></li>)}
    </ul>}
  </PageShell>
}
