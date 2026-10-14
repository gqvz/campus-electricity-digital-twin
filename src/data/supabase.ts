import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'
import { liveMode, supabaseAnonKey, supabaseUrl } from './config'

let client: SupabaseClient | null = null
/** The shared client, or null in demo mode. */
export function supabase(): SupabaseClient | null {
  if (!liveMode) return null
  client ??= createClient(supabaseUrl!, supabaseAnonKey!, { auth: { persistSession: true, autoRefreshToken: true } })
  return client
}
