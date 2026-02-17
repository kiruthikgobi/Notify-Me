
import { createClient } from '@supabase/supabase-js';

/**
 * Robustly retrieves environment variables from various possible injection points.
 * Checks Vite's import.meta.env and Node-style process.env.
 */
const getEnvVar = (key: string): string => {
  const viteKey = `VITE_${key}`;
  
  // Try import.meta.env (Vite standard)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env[key]) return String(import.meta.env[key]);
    if (import.meta.env[viteKey]) return String(import.meta.env[viteKey]);
  }
  
  // Try process.env (Injected by vite.config.ts define)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[key]) return String(process.env[key]);
    if (process.env[viteKey]) return String(process.env[viteKey]);
  }

  return '';
};

// Use the specific keys provided by the user for this application
const PROVIDED_URL = 'https://bttlforziagqkrtvetuf.supabase.co';
const PROVIDED_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0dGxmb3J6aWFncWtydHZldHVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxODAxNDAsImV4cCI6MjA4NTc1NjE0MH0.ux3vud3JUH087cknL5W_j8HJS4Gg6Ozh7OqD1SaA75c';

const rawUrl = getEnvVar('SUPABASE_URL');
const rawKey = getEnvVar('SUPABASE_ANON_KEY');

// Clean values and prioritize environment variables, falling back to provided keys
const supabaseUrl = (rawUrl && rawUrl !== 'undefined' && rawUrl !== 'null' && rawUrl !== '') 
  ? rawUrl 
  : PROVIDED_URL;

const supabaseAnonKey = (rawKey && rawKey !== 'undefined' && rawKey !== 'null' && rawKey !== '') 
  ? rawKey 
  : PROVIDED_KEY;

// Validation check
const isConfigured = supabaseUrl.length > 0 && !supabaseUrl.includes('placeholder');

if (!isConfigured) {
  console.error(
    "CRITICAL CONFIGURATION ERROR: Supabase credentials are missing.\n" +
    "Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your environment variables."
  );
}

/**
 * Initialize the Supabase client.
 * Using provided project details to ensure immediate functionality and connectivity.
 */
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// Export helper to check if we are in a valid state
export const isSupabaseConfigured = () => isConfigured;
