import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Usa variáveis de ambiente (.env / Netlify) com fallback para o projeto padrão,
// assim o dev local e o build de deploy funcionam sem configuração extra.
// A anon key é pública (protegida por RLS) — pode ir no bundle.
const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) || 'https://ddndpnibptrvurabacgi.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbmRwbmlicHRydnVyYWJhY2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxOTUzNDUsImV4cCI6MjA5ODc3MTM0NX0.keVTayQUNOlyfg-AhmrPphbRMhv6DBygMQof_CB6Bn8';

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'maislead-auth'
    }
  }
);
