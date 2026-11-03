import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type Role = 'auditor' | 'reviewer' | 'admin'
export type AuthState = { loading: boolean; session: Session | null; role: Role | null; displayName: string | null }

export function useAuth() {
  const client = supabase()
  const [state, setState] = useState<AuthState>({ loading: Boolean(client), session: null, role: null, displayName: null })
  useEffect(() => {
    if (!client) return
    let live = true
    const resolve = async (session: Session | null) => {
      let role: Role | null = null, displayName: string | null = null
      if (session) {
        const { data } = await client.from('team_members').select('role, display_name').eq('user_id', session.user.id).maybeSingle()
        role = (data?.role as Role) ?? null; displayName = data?.display_name ?? null
      }
      if (live) setState({ loading: false, session, role, displayName })
    }
    client.auth.getSession().then(({ data }) => resolve(data.session))
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => { void resolve(session) })
    return () => { live = false; sub.subscription.unsubscribe() }
  }, [client])
  const signIn = useCallback(async (email: string) => {
    if (!client) return { error: 'Sign-in is unavailable in demo mode.' }
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/audit` } })
    return { error: error?.message ?? null }
  }, [client])
  const signOut = useCallback(async () => { await client?.auth.signOut() }, [client])
  return { ...state, configured: Boolean(client), signIn, signOut, isTeam: state.role !== null, isReviewer: state.role === 'reviewer' || state.role === 'admin' }
}
