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

// "Manter conectado": storage híbrido. Quando a flag está ligada (padrão),
// a sessão vai pro localStorage (sobrevive a fechar o navegador). Quando
// desligada, vai pro sessionStorage (some ao fechar a aba). A leitura tenta
// os dois, então alternar a flag depois não perde a sessão atual.
const REMEMBER_KEY = 'maislead-remember';
function rememberOn(): boolean {
  try { return localStorage.getItem(REMEMBER_KEY) !== '0'; } catch { return true; }
}
const hybridStorage = {
  getItem(key: string): string | null {
    try { return localStorage.getItem(key) ?? sessionStorage.getItem(key); } catch { return null; }
  },
  setItem(key: string, value: string): void {
    try {
      if (rememberOn()) { localStorage.setItem(key, value); sessionStorage.removeItem(key); }
      else { sessionStorage.setItem(key, value); localStorage.removeItem(key); }
    } catch { /* storage indisponível — ignora */ }
  },
  removeItem(key: string): void {
    try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch { /* ignore */ }
  },
};

/** Define a preferência "manter conectado" antes do login (lida pelo hybridStorage). */
export function setRememberSession(on: boolean): void {
  try { localStorage.setItem(REMEMBER_KEY, on ? '1' : '0'); } catch { /* ignore */ }
}

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'maislead-auth',
      storage: hybridStorage
    }
  }
);
