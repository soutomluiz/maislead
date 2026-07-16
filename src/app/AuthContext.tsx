import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;
type Account = Tables<"accounts">;

interface AuthCtx {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  account: Account | null;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (name: string, email: string, password: string, company?: string) => Promise<{ error?: string; needsConfirm?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
}

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [account, setAccount] = useState<Account | null>(null);

  const loadProfile = useCallback(async (userId: string) => {
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(prof ?? null);
    if (prof?.account_id) {
      const { data: acc } = await supabase.from("accounts").select("*").eq("id", prof.account_id).maybeSingle();
      setAccount(acc ?? null);
    } else {
      setAccount(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    // IMPORTANTE: não chamar funções supabase async aqui dentro — causa deadlock do auth lock.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // Carrega perfil/conta fora do callback de auth (evita o deadlock do supabase-js).
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setProfile(null); setAccount(null); return; }
    loadProfile(uid);
  }, [session?.user?.id, loadProfile]);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: error.message } : {};
  };

  const signUp: AuthCtx["signUp"] = async (name, email, password, company) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim(), company_name: (company ?? "").trim() } },
    });
    if (error) return { error: error.message };
    // Se a confirmação de e-mail estiver ligada, não há sessão ainda.
    return { needsConfirm: !data.session };
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  const resetPassword: AuthCtx["resetPassword"] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}`,
    });
    return error ? { error: error.message } : {};
  };

  return (
    <AuthContext.Provider value={{ loading, session, profile, account, refresh, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
