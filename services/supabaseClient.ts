
import { createClient } from '@supabase/supabase-js';

/**
 * Utility to fetch environment variables in a browser ESM environment.
 * Prioritizes process.env injected by build tools or shims.
 */
const getEnv = (key: string) => {
  if (typeof window !== 'undefined' && (window as any).process?.env?.[key]) {
    return (window as any).process.env[key];
  }
  return undefined;
};

// Configuration: Replace fallback values with your project credentials if not using environment variables.
const supabaseUrl = getEnv('SUPABASE_URL') || 'https://bttlforziagqkrtvetuf.supabase.co';
const supabaseAnonKey = getEnv('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0dGxmb3J6aWFncWtydHZldHVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxODAxNDAsImV4cCI6MjA4NTc1NjE0MH0.ux3vud3JUH087cknL5W_j8HJS4Gg6Ozh7OqD1SaA75c';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
