export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
/** Without credentials the app runs in demo mode on illustrative fixtures. */
export const liveMode = Boolean(supabaseUrl && supabaseAnonKey)
export const timeZone = 'Asia/Kolkata'
