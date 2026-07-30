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
  isPlatformAdmin: boolean;
  /** true quando o usuário chegou por um link de recovery (definir/redefinir senha). */
  recovery: boolean;
  /** preenchido quando o link de recovery está expirado/inválido (ex.: "otp_expired"). */
  recoveryError: string | null;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  /** SSO Google (OAuth) — redireciona pro provedor e volta pra origin. */
  signInWithGoogle: () => Promise<{ error?: string }>;
  signUp: (name: string, email: string, password: string, company?: string) => Promise<{ error?: string; needsConfirm?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  /** define a nova senha (fluxo de recovery) e, em sucesso, libera o acesso ao painel. */
  updatePassword: (password: string) => Promise<{ error?: string }>;
  /** sai do fluxo de recovery (usado no botão "voltar ao login" quando o link expirou). */
  clearRecovery: () => void;
}

const AuthContext = createContext<AuthCtx | null>(null);

// Captura o hash UMA vez, sincronamente no load do módulo — antes do supabase-js
// processar/limpar a URL. É assim que detectamos o retorno de um link de recovery
// mesmo que o evento PASSWORD_RECOVERY não chegue a tempo do primeiro render.
const INITIAL_HASH = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
const HASH_PARAMS = new URLSearchParams(INITIAL_HASH);
const HASH_IS_RECOVERY = HASH_PARAMS.get("type") === "recovery";
const HASH_ERROR = HASH_PARAMS.get("error_code") || HASH_PARAMS.get("error") || null;

// Remove os tokens/erro do hash pra que um refresh não re-dispare o fluxo de recovery.
function stripHash() {
  if (typeof window !== "undefined" && window.location.hash) {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  // "Estamos num fluxo de recovery" = veio type=recovery OU o hash trouxe um erro
  // de auth (link expirado costuma vir só como error_code=otp_expired, sem type).
  // Erro só no HASH (não na query) — neste app, hash de auth só vem de link de e-mail.
  const [recovery, setRecovery] = useState(HASH_IS_RECOVERY || !!HASH_ERROR);
  const [recoveryError, setRecoveryError] = useState<string | null>(HASH_ERROR);

  const loadProfile = useCallback(async (userId: string) => {
    const { data: prof } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(prof ?? null);
    if (prof?.account_id) {
      const { data: acc } = await supabase.from("accounts").select("*").eq("id", prof.account_id).maybeSingle();
      setAccount(acc ?? null);
    } else {
      setAccount(null);
    }
    // Superadmin de plataforma (RLS: só devolve a própria linha via user_id = auth.uid()).
    const db = supabase as unknown as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> } } } };
    const { data: pa } = await db.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
    setIsPlatformAdmin(!!pa);
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
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // Backup da detecção por hash: o supabase-js emite este evento ao processar o link.
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(s);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  // Carrega perfil/conta fora do callback de auth (evita o deadlock do supabase-js).
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) { setProfile(null); setAccount(null); setIsPlatformAdmin(false); return; }
    loadProfile(uid);
  }, [session?.user?.id, loadProfile]);

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? { error: error.message } : {};
  };

  const signInWithGoogle: AuthCtx["signInWithGoogle"] = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}` },
    });
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

  const updatePassword: AuthCtx["updatePassword"] = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    // senha definida com sucesso → sai do fluxo de recovery e libera o painel
    stripHash();
    setRecoveryError(null);
    setRecovery(false);
    return {};
  };

  const clearRecovery = useCallback(() => {
    stripHash();
    setRecovery(false);
    setRecoveryError(null);
  }, []);

  return (
    <AuthContext.Provider value={{ loading, session, profile, account, isPlatformAdmin, recovery, recoveryError, refresh, signIn, signInWithGoogle, signUp, signOut, resetPassword, updatePassword, clearRecovery }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
