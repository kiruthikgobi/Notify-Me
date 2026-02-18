
import { createClient } from '@supabase/supabase-js';

/**
 * Enterprise-grade environment variable resolution.
 * Prevents crashes if import.meta.env is undefined in certain runtimes.
 */
const resolveEnv = (key: string, fallback: string): string => {
  try {
    // Try Vite's standard import.meta.env
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      const val = (import.meta as any).env[key];
      if (val) return val;
    }
  } catch (e) {}

  try {
    // Try process.env (Vite define polyfill)
    if (typeof process !== 'undefined' && process.env) {
      const val = (process.env as any)[key];
      if (val) return val;
    }
  } catch (e) {}

  return fallback;
};

const FALLBACK_URL = 'https://bttlforziagqkrtvetuf.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0dGxmb3J6aWFncWtydHZldHVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxODAxNDAsImV4cCI6MjA4NTc1NjE0MH0.ux3vud3JUH087cknL5W_j8HJS4Gg6Ozh7OqD1SaA75c';

const supabaseUrl = resolveEnv('VITE_SUPABASE_URL', FALLBACK_URL);
const supabaseAnonKey = resolveEnv('VITE_SUPABASE_ANON_KEY', FALLBACK_KEY);

if (supabaseUrl === FALLBACK_URL) {
  console.warn('Supabase URL resolved to fallback. Check environment configuration.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey;
};
