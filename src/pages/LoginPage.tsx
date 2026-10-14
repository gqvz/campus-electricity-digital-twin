import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../data/useAuth'
import { PageShell } from './PageShell'

export function LoginPage() {
  const auth = useAuth()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')
  if (auth.session && auth.isTeam) return <Navigate to="/audit" replace />
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setState('sending')
    const { error } = await auth.signIn(email.trim())
    if (error) { setState('error'); setMessage(error) } else setState('sent')
  }
  return <PageShell title="Team sign-in" lead="Audit entry is for the project team. Visitors can explore the published results without signing in.">
    {!auth.configured ? <p className="page-note" role="status">This build is running in demo mode (no backend configured), so sign-in is unavailable.</p> :
    auth.session && !auth.isTeam ? <p className="page-note" role="status">You are signed in as {auth.session.user.email}, but this account is not on the team list yet. Ask a project admin to add you, then reload.</p> :
    <form className="page-card form-stack" onSubmit={submit}>
      <label className="field"><span>Email</span>
        <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
      </label>
      <button className="btn primary" disabled={state === 'sending' || state === 'sent'}>{state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}</button>
      {state === 'sent' && <p className="page-note" role="status">Check {email} for a sign-in link. It works once.</p>}
      {state === 'error' && <p className="field-error" role="alert">{message}</p>}
    </form>}
  </PageShell>
}
