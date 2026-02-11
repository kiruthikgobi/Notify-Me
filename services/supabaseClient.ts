import { createClient } from '@supabase/supabase-js';

/**
 * Utility to fetch environment variables.
 * In Vite, variables prefixed with VITE_ are automatically exposed on import.meta.env.
 * For general deployment compatibility, we also check process.env.
 */
const getEnv = (key: string) => {
  // Try Vite's specific env object first
  const viteValue = (import.meta as any).env?.[`VITE_${key}`];
  if (viteValue) return viteValue;

  // Fallback to process.env (injected by Vite define or build environment)
  return process.env[key];
};

const supabaseUrl = getEnv('SUPABASE_URL') || 'https://bttlforziagqkrtvetuf.supabase.co';
const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0dGxmb3J6aWFncWtydHZldHVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxODAxNDAsImV4cCI6MjA4NTc1NjE0MH0.ux3vud3JUH087cknL5W_j8HJS4Gg6Ozh7OqD1SaA75c';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);