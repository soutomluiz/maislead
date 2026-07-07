import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://ddndpnibptrvurabacgi.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkbmRwbmlicHRydnVyYWJhY2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxOTUzNDUsImV4cCI6MjA5ODc3MTM0NX0.keVTayQUNOlyfg-AhmrPphbRMhv6DBygMQof_CB6Bn8";

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: true
    }
  }
);