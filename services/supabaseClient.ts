
import { createClient } from '@supabase/supabase-js';

const getEnv = (key: string, fallback: string) => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) return process.env[key];
  if (import.meta.env && import.meta.env[key]) return import.meta.env[key];
  return fallback;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL', 'https://bttlforziagqkrtvetuf.supabase.co');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0dGxmb3J6aWFncWtydHZldHVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxODAxNDAsImV4cCI6MjA4NTc1NjE0MH0.ux3vud3JUH087cknL5W_j8HJS4Gg6Ozh7OqD1SaA75c');

if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
  console.warn('Supabase URL missing or set to placeholder.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isSupabaseConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey && !supabaseUrl.includes('placeholder');
};
