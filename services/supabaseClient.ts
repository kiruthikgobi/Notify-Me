import { createClient } from '@supabase/supabase-js'

/**
 * 🔹 Replace these dummy values with your real Supabase credentials
 * Supabase → Settings → API
 */

const SUPABASE_URL = 'https://bttlforziagqkrtvetuf.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0dGxmb3J6aWFncWtydHZldHVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxODAxNDAsImV4cCI6MjA4NTc1NjE0MH0.ux3vud3JUH087cknL5W_j8HJS4Gg6Ozh7OqD1SaA75c'

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase credentials are missing.')
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
)

export const isSupabaseConfigured = () => {
  return !!SUPABASE_URL && !!SUPABASE_ANON_KEY
}

