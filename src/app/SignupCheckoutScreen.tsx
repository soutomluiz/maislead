import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

// Tela de criação de conta + checkout (aparece ao clicar em assinar um plano na landing).
// Visual fiel ao protótipo maisLEAD Cadastro.dc.html. Plano/preço/features REAIS via get-plans.
// Fluxo: cria conta (register-checkout) → Stripe Checkout do price exato → webhook confirma.

interface Plan {
  slug: string; name: string; tag: string; free: boolean;
  monthly: number | null; annualPerMonth: number | null; annualTotal: number | null;
  discountPct: number; features: string[];
}

const LANDING_PRICING = "https://maislead.com/#pricing";

export function SignupCheckoutScreen() {
  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const planSlug = (params.get("plan") || "pro").toLowerCase();
  const interval = params.get("interval") === "annual" || params.get("interval") === "yearly" ? "annual" : "monthly";
  const yearly = interval === "annual";

  const [plan, setPlan] = useState<Plan | null>(null);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.functions.invoke("get-plans").then(({ data }) => {
      const p = data?.plans?.[planSlug] ?? data?.plans?.pro ?? null;
      if (p) setPlan(p);
    }).catch(() => { /* mostra placeholders vazios */ });
  }, [planSlug]);

  // força da senha (mesma regra do protótipo)
  let strength = 0;
  if (pass.length >= 8) strength++;
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) strength++;
  if (/[0-9]/.test(pass) || /[^A-Za-z0-9]/.test(pass)) strength++;
  if (pass.length === 0) strength = 0;
  const stColor = strength === 1 ? "#f43f5e" : strength === 2 ? "#f59e0b" : "#10b981";
  const bars = [0, 1, 2].map((i) => (i < strength ? stColor : "#ecebf5"));
  const stLabel = ["Digite uma senha", "Senha fraca", "Senha razoável", "Senha forte"][strength];

  const fmt = (n: number | null | undefined) => "R$ " + (n ?? 0);
  const price = plan ? (yearly ? plan.annualPerMonth : plan.monthly) : null;
  const cycleLabel = yearly ? "Anual" : "Mensal";
  const perLabel = yearly ? "/mês, cobrado anual" : "/mês";
  const saveLabel = yearly && plan && plan.discountPct > 0 ? `Você economiza ${plan.discountPct}% no plano anual` : "";
  const features = plan?.features ?? [];

  const ERRORS: Record<string, string> = {
    invalid_email: "E-mail inválido. Confira e tente de novo.",
    weak_password: "Senha fraca. Use 8+ caracteres, com maiúscula, minúscula e número ou símbolo.",
    email_exists: "Já existe uma conta com esse e-mail. Faça login para continuar.",
    missing_price: "Este plano ainda não está disponível. Tente novamente em breve.",
    missing_api_key: "Pagamento ainda não está configurado. Tente novamente em breve.",
    generic: "Não foi possível continuar agora. Tente novamente.",
  };

  async function googleSignup() {
    if (busy) return;
    setErr(null);
    const redirectTo = `${window.location.origin}/?plan=${planSlug}&interval=${interval}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) setErr(ERRORS.generic);
  }

  async function submit() {
    if (busy) return;
    setErr(null);
    if (!name.trim()) return setErr("Informe seu nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr(ERRORS.invalid_email);
    if (strength < 3) return setErr(ERRORS.weak_password);
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-checkout", {
        body: { name, company, email, password: pass, plan: planSlug, interval, origin: window.location.origin },
      });
      let code: string | null = data?.error ?? null;
      if (error) {
        code = "generic";
        try { const b = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); code = b?.error ?? code; } catch { /* ignore */ }
      }
      if (data?.url) { window.location.href = data.url; return; }
      setErr(ERRORS[code ?? "generic"] ?? ERRORS.generic);
    } catch {
      setErr(ERRORS.generic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", minHeight: "100vh", display: "flex", background: "#f4f5fb", color: "#211d3b" }}>
      <style>{`
        @keyframes scFloatUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .sc-input:focus{border-color:#6d5cf5 !important;box-shadow:0 0 0 3px rgba(109,92,245,.14) !important;}
        .sc-input::placeholder{color:#a6a3c0;}
        @media(max-width:880px){ .sc-wrap{flex-direction:column;} .sc-left{width:100% !important;max-width:none !important;} }
      `}</style>

      <div className="sc-wrap" style={{ display: "flex", width: "100%", minHeight: "100vh" }}>
        {/* ============ ESQUERDA: RESUMO DO PLANO ============ */}
        <div className="sc-left" style={{ width: "44%", maxWidth: 560, background: "linear-gradient(160deg,#2a2350 0%,#4a3aa0 52%,#6d5cf5 100%)", color: "#fff", padding: "48px 52px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -120, right: -120, width: 360, height: 360, borderRadius: "50%", background: "rgba(255,255,255,.06)" }} />
          <div style={{ position: "absolute", bottom: -90, left: -70, width: 260, height: 260, borderRadius: "50%", background: "rgba(255,255,255,.05)" }} />

          {/* logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 11, position: "relative" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,.16)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(0,0,0,.18)" }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.2 5.4L20 9.3l-4 4 1 5.7-5-3-5 3 1-5.7-4-4 5.8-.9z" /></svg>
            </div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.01em" }}>mais<span style={{ color: "#c9b8ff" }}>LEAD</span></div>
          </div>

          {/* resumo */}
          <div style={{ marginTop: 52, position: "relative" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", color: "rgba(255,255,255,.6)" }}>Resumo do pedido</div>

            <div style={{ marginTop: 20, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.16)", borderRadius: 20, padding: "24px 26px", backdropFilter: "blur(8px)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,.65)", fontWeight: 600 }}>Plano selecionado</div>
                  <div style={{ fontSize: 24, fontWeight: 800, marginTop: 2 }}>{plan?.name ?? "…"}</div>
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 700, background: "rgba(255,255,255,.18)", padding: "6px 12px", borderRadius: 20 }}>{cycleLabel}</div>
              </div>

              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginTop: 20 }}>
                <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1, letterSpacing: "-.02em" }}>{price != null ? fmt(price) : "—"}</div>
                <div style={{ fontSize: 14, color: "rgba(255,255,255,.7)", fontWeight: 600, paddingBottom: 6 }}>{perLabel}</div>
              </div>
              <div style={{ fontSize: 13, color: "#c9b8ff", fontWeight: 600, marginTop: 6, minHeight: 18 }}>{saveLabel}</div>

              <div style={{ height: 1, background: "rgba(255,255,255,.16)", margin: "22px 0" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                {features.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14 }}>
                    <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    </span>
                    {f}
                  </div>
                ))}
              </div>
            </div>

            <a href={LANDING_PRICING} style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 20, fontSize: 13.5, fontWeight: 600, color: "rgba(255,255,255,.75)", textDecoration: "none" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>Trocar de plano
            </a>
          </div>

          {/* selos */}
          <div style={{ marginTop: "auto", paddingTop: 40, position: "relative", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(255,255,255,.8)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9b8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>Pagamento seguro via Stripe
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(255,255,255,.8)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9b8ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0z" /><path d="M9 12l2 2 4-4" /></svg>Cancele quando quiser, sem multa
            </div>
          </div>
        </div>

        {/* ============ DIREITA: FORMULÁRIO ============ */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 40px" }}>
          <div style={{ width: "100%", maxWidth: 420, animation: "scFloatUp .5s ease both" }}>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.02em" }}>Crie sua conta</div>
            <div style={{ fontSize: 14.5, color: "#6f6c88", marginTop: 6 }}>Comece a prospectar em minutos. Já tem conta? <a href={window.location.origin} style={{ fontWeight: 700, color: "#6d5cf5", textDecoration: "none" }}>Entrar</a></div>

            <button onClick={googleSignup} style={{ width: "100%", height: 50, marginTop: 26, border: "1px solid #e4e2f0", borderRadius: 13, background: "#fff", color: "#211d3b", fontSize: 14.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 11, transition: ".15s" }}>
              <svg width="19" height="19" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" /></svg>
              Continuar com Google
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "22px 0" }}>
              <div style={{ flex: 1, height: 1, background: "#ecebf5" }} />
              <span style={{ fontSize: 12.5, color: "#a6a3c0", fontWeight: 600 }}>ou com e-mail</span>
              <div style={{ flex: 1, height: 1, background: "#ecebf5" }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Nome completo" icon={<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />} extraIcon={<circle cx="12" cy="7" r="4" />}>
                <input className="sc-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" style={inputStyle} />
              </Field>
              <Field label="Empresa" icon={<path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />}>
                <input className="sc-input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Nome da sua empresa" style={inputStyle} />
              </Field>
              <Field label="E-mail de trabalho" icon={<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></>}>
                <input className="sc-input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="voce@empresa.com" style={inputStyle} />
              </Field>

              <div>
                <label style={labelStyle}>Senha</label>
                <div style={{ position: "relative" }}>
                  <span style={iconWrap}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#a6a3c0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg></span>
                  <input className="sc-input" value={pass} onChange={(e) => setPass(e.target.value)} type={show ? "text" : "password"} placeholder="Mínimo 8 caracteres" onKeyDown={(e) => { if (e.key === "Enter") submit(); }} style={{ ...inputStyle, padding: "0 44px 0 42px" }} />
                  <span onClick={() => setShow((s) => !s)} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", cursor: "pointer" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a6a3c0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                  </span>
                </div>
                <div style={{ display: "flex", gap: 5, marginTop: 9 }}>
                  {bars.map((c, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 3, background: c, transition: ".2s" }} />)}
                </div>
                <div style={{ fontSize: 12, color: "#8f8caa", marginTop: 6 }}>{stLabel}</div>
              </div>
            </div>

            {err && <div style={{ marginTop: 16, fontSize: 13, color: "#f43f5e", fontWeight: 600, lineHeight: 1.5 }}>{err}</div>}

            <button onClick={submit} disabled={busy} style={{ width: "100%", height: 52, marginTop: 24, border: "none", borderRadius: 14, background: "linear-gradient(135deg,#6d5cf5,#8b6bff)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: busy ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, boxShadow: "0 10px 24px rgba(109,92,245,.32)", opacity: busy ? 0.8 : 1 }}>
              {busy ? "Processando…" : "Ir para o pagamento"}
              {!busy && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>}
            </button>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 16, fontSize: 12.5, color: "#8f8caa" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a6a3c0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Seus dados são protegidos. Cobrança processada pela Stripe.
            </div>

            <div style={{ fontSize: 12, color: "#a6a3c0", textAlign: "center", marginTop: 18, lineHeight: 1.6 }}>Ao continuar, você concorda com os <a href="https://maislead.com/termos.html" style={{ fontWeight: 600, color: "#6d5cf5", textDecoration: "none" }}>Termos</a> e a <a href="https://maislead.com/privacidade.html" style={{ fontWeight: 600, color: "#6d5cf5", textDecoration: "none" }}>Política de Privacidade</a>.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = { width: "100%", height: 50, borderRadius: 13, border: "1px solid #e4e2f0", background: "#fbfbfe", padding: "0 14px 0 42px", fontSize: 14.5, color: "#211d3b", outline: "none", transition: ".15s", boxSizing: "border-box" };
const labelStyle: CSSProperties = { fontSize: 13, fontWeight: 600, display: "block", marginBottom: 7 };
const iconWrap: CSSProperties = { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" };

function Field({ label, icon, extraIcon, children }: { label: string; icon: ReactNode; extraIcon?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <div style={{ position: "relative" }}>
        <span style={iconWrap}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#a6a3c0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}{extraIcon}</svg>
        </span>
        {children}
      </div>
    </div>
  );
}
