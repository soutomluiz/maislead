import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { useLang } from "./LangTheme";
import { setRememberSession } from "@/integrations/supabase/client";
import { AuthShell, FormLogo, GoogleIcon, authLabel, fieldBorder, fieldBg, iconColor } from "./AuthLayout";

type Mode = "signin" | "reset" | "signup";
type Focused = "email" | "pass" | "name" | "company" | null;

/* ── ícones de campo (traçado, cor reativa ao foco) ── */
const MailIcon = (c: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2.5" /><path d="m3 7 9 6 9-6" /></svg>
);
const LockIcon = (c: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2.5" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);
const UserIcon = (c: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);
const BuildingIcon = (c: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M9 22v-4h6v4" /><path d="M9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01" /></svg>
);
const EyeSvg = (open: boolean) =>
  open ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8f8ba8" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="m1 1 22 22" /></svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8f8ba8" strokeWidth="2"><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" /><circle cx="12" cy="12" r="3" /></svg>
  );
const ArrowIcon = (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
const AlertIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
);
const CheckStripIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f9d6b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M20 6 9 17l-5-5" /></svg>
);

const inputBase = (focused: boolean, filled: boolean, hasRight: boolean): CSSProperties => ({
  width: "100%", height: 50, border: `1.5px solid ${fieldBorder(focused, filled)}`, background: fieldBg(focused),
  borderRadius: 13, padding: hasRight ? "0 46px 0 42px" : "0 14px 0 42px", fontSize: 14.5, color: "#211d3b", outline: "none",
});

/* Campo genérico (escopo do módulo → identidade estável, não remonta ao digitar). */
function AuthField(props: {
  id: string; label: ReactNode; icon: (c: string) => ReactNode; type?: string; value: string;
  onChange: (v: string) => void; focused: boolean; onFocus: () => void; onBlur: () => void;
  placeholder?: string; autoComplete?: string; right?: ReactNode;
}) {
  const { id, label, icon, type = "text", value, onChange, focused, onFocus, onBlur, placeholder, autoComplete, right } = props;
  return (
    <div>
      {typeof label === "string" ? <label htmlFor={id} style={authLabel}>{label}</label> : label}
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", display: "flex" }}>{icon(iconColor(focused))}</span>
        <input
          id={id} className="mla-field" type={type} value={value}
          onChange={(e) => onChange(e.target.value)} onFocus={onFocus} onBlur={onBlur}
          placeholder={placeholder} autoComplete={autoComplete}
          style={inputBase(focused, !!value, !!right)}
        />
        {right}
      </div>
    </div>
  );
}

const errorStrip = (msg: string) => (
  <div className="mla-erroir" style={{ marginTop: 16, background: "rgba(244,63,94,.07)", border: "1px solid #f6d3d9", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, fontWeight: 600, color: "#c81e42" }}>
    {AlertIcon}<span>{msg}</span>
  </div>
);
const okStrip = (msg: string) => (
  <div className="mla-erroir" style={{ marginTop: 16, background: "rgba(16,185,129,.08)", border: "1px solid #bfe9d6", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, fontWeight: 600, color: "#0f9d6b" }}>
    {CheckStripIcon}<span>{msg}</span>
  </div>
);

const submitBtn: CSSProperties = {
  width: "100%", height: 52, marginTop: 20, border: "none", borderRadius: 14,
  background: "linear-gradient(140deg,#5b3ae8,#4c2ee0 55%,#3f24c4)", color: "#fff", fontSize: 15, fontWeight: 800,
  letterSpacing: "-.005em", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
  boxShadow: "0 8px 22px rgba(76,46,224,.3)",
};

function SubmitButton({ busy, label, busyLabel, withArrow = true }: { busy: boolean; label: string; busyLabel: string; withArrow?: boolean }) {
  return (
    <button type="submit" className="mla-submit" disabled={busy} style={submitBtn}>
      {busy ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          <span className="mla-spinner" style={{ width: 16, height: 16, borderRadius: "50%", border: "2.2px solid rgba(255,255,255,.35)", borderTopColor: "#fff", display: "inline-block" }} />
          {busyLabel}
        </span>
      ) : (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>{label}{withArrow && ArrowIcon}</span>
      )}
    </button>
  );
}

const googleBtnStyle = (busy: boolean): CSSProperties => ({
  width: "100%", height: 48, border: "1px solid #e4e1f0", background: "#fff", borderRadius: 13,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 14, fontWeight: 700,
  color: "#3b3757", cursor: busy ? "not-allowed" : "pointer",
});

const divider = (label: string) => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 4px" }}>
    <div style={{ flex: 1, height: 1, background: "#eae7f5" }} />
    <div style={{ fontSize: 11, fontWeight: 700, color: "#a6a3c0", letterSpacing: ".09em", textTransform: "uppercase" }}>{label}</div>
    <div style={{ flex: 1, height: 1, background: "#eae7f5" }} />
  </div>
);

const heading = (title: string, sub: string) => (
  <div>
    <div style={{ fontSize: 29, fontWeight: 800, letterSpacing: "-.028em", lineHeight: 1.2 }}>{title}</div>
    <div style={{ fontSize: 14.5, color: "#6f6a8c", marginTop: 9, fontWeight: 500, lineHeight: 1.55 }}>{sub}</div>
  </div>
);

const linkBtn: CSSProperties = { fontWeight: 800, color: "#4c2ee0", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 13.5 };

const emailValid = (v: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim());

export function AuthScreen() {
  const { t } = useLang();
  const { signIn, signInWithGoogle, signUp, resetPassword } = useAuth();
  const L = t.login;
  const a = t.auth;

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [focus, setFocus] = useState<Focused>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function go(next: Mode) { setMode(next); setErr(null); setOk(null); }
  const change = (setter: (v: string) => void) => (v: string) => { setter(v); setErr(null); };
  const focusProps = (key: Exclude<Focused, null>) => ({ focused: focus === key, onFocus: () => setFocus(key), onBlur: () => setFocus(null) });

  async function onGoogle() {
    setErr(null); setBusy(true);
    const r = await signInWithGoogle();
    if (r.error) { setErr(r.error); setBusy(false); }
    // sucesso → o navegador redireciona pro Google; deixa o loading aceso.
  }

  async function submitSignIn(e: FormEvent) {
    e.preventDefault();
    setErr(null); setOk(null);
    if (!emailValid(email)) { setErr(L.errEmail); return; }
    if (!pass) { setErr(L.errPass); return; }
    setRememberSession(remember);
    setBusy(true);
    try {
      const r = await signIn(email, pass);
      if (r.error) setErr(r.error);
    } finally { setBusy(false); }
  }

  async function submitReset(e: FormEvent) {
    e.preventDefault();
    setErr(null); setOk(null);
    if (!emailValid(email)) { setErr(L.errEmail); return; }
    setBusy(true);
    try {
      const r = await resetPassword(email);
      if (r.error) setErr(r.error);
      else setOk(a.resetSent);
    } finally { setBusy(false); }
  }

  async function submitSignUp(e: FormEvent) {
    e.preventDefault();
    setErr(null); setOk(null);
    if (!name.trim()) { setErr(a.name + " — " + a.required); return; }
    if (!company.trim()) { setErr(a.company + " — " + a.required); return; }
    if (!emailValid(email)) { setErr(L.errEmail); return; }
    if (pass.length < 8) { setErr(a.pwMin); return; }
    setRememberSession(true);
    setBusy(true);
    try {
      const r = await signUp(name, email, pass, company);
      if (r.error) setErr(r.error);
      else if (r.needsConfirm) { setOk(a.checkEmail); go("signin"); }
    } finally { setBusy(false); }
  }

  const eyeBtn = (
    <button type="button" onClick={() => setShowPw((v) => !v)} className="mla-eye" title={L.showPass}
      style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "transparent", border: "none" }}>
      {EyeSvg(showPw)}
    </button>
  );

  const rememberBox = (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 13, color: "#4b4767", fontWeight: 600 }}>
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
        <span style={{ width: 19, height: 19, borderRadius: 6, border: `1.5px solid ${remember ? "#4c2ee0" : "#d3cfe6"}`, background: remember ? "#4c2ee0" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", transition: "all .18s ease" }}>
          {remember && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
        </span>
        {L.remember}
      </label>
    </div>
  );

  const passLabel = (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 7 }}>
      <label htmlFor="ml-pass" style={{ fontSize: 12.5, fontWeight: 700, color: "#4b4767" }}>{L.pass}</label>
      <button type="button" onClick={() => go("reset")} style={{ fontSize: 12, fontWeight: 700, color: "#4c2ee0", background: "none", border: "none", cursor: "pointer", padding: 0 }}>{L.forgot}</button>
    </div>
  );

  /* ─────────── SIGN IN ─────────── */
  if (mode === "signin") {
    return (
      <AuthShell>
        <FormLogo />
        {heading(L.title, L.sub)}

        <div style={{ marginTop: 26 }}>
          <button type="button" onClick={onGoogle} disabled={busy} className="mla-ggl" style={googleBtnStyle(busy)}>
            <GoogleIcon />{L.google}
          </button>
        </div>

        {divider(L.or)}

        <form onSubmit={submitSignIn} noValidate style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
            <AuthField id="ml-email" label={L.email} icon={MailIcon} type="email" value={email} onChange={change(setEmail)} {...focusProps("email")} placeholder={L.emailPh} autoComplete="email" />
            <AuthField id="ml-pass" label={passLabel} icon={LockIcon} type={showPw ? "text" : "password"} value={pass} onChange={change(setPass)} {...focusProps("pass")} placeholder="••••••••••" autoComplete="current-password" right={eyeBtn} />
            {rememberBox}
          </div>

          {err && errorStrip(err)}
          {ok && okStrip(ok)}

          <SubmitButton busy={busy} label={L.signIn} busyLabel={L.signing} />
        </form>

        <div style={{ marginTop: 22, textAlign: "center", fontSize: 13.5, color: "#6f6a8c", fontWeight: 500 }}>
          {L.noAccount} <button type="button" onClick={() => go("signup")} style={linkBtn}>{L.createAccount}</button>
        </div>

        <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid #f0edf8", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, fontSize: 12, color: "#8f8ba8", fontWeight: 600 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a6a3c0" strokeWidth="2.2"><path d="M20 6 9 17l-5-5" /></svg>
          {L.trial}
        </div>
      </AuthShell>
    );
  }

  /* ─────────── RESET (esqueci a senha) ─────────── */
  if (mode === "reset") {
    return (
      <AuthShell>
        <FormLogo />
        {heading(a.resetTitle, a.resetSub)}

        <form onSubmit={submitReset} noValidate style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ marginTop: 24 }}>
            <AuthField id="ml-email" label={L.email} icon={MailIcon} type="email" value={email} onChange={change(setEmail)} {...focusProps("email")} placeholder={L.emailPh} autoComplete="email" />
          </div>
          {err && errorStrip(err)}
          {ok && okStrip(ok)}
          <SubmitButton busy={busy} label={a.sendReset} busyLabel={L.signing} withArrow={false} />
        </form>

        <div style={{ marginTop: 22, textAlign: "center", fontSize: 13.5 }}>
          <button type="button" onClick={() => go("signin")} style={linkBtn}>{a.backToLogin}</button>
        </div>
      </AuthShell>
    );
  }

  /* ─────────── SIGN UP (criar conta) ─────────── */
  return (
    <AuthShell>
      <FormLogo />
      {heading(a.signUpTitle, a.signUpSub)}

      <div style={{ marginTop: 22 }}>
        <button type="button" onClick={onGoogle} disabled={busy} className="mla-ggl" style={googleBtnStyle(busy)}>
          <GoogleIcon />{L.google}
        </button>
      </div>

      {divider(L.or)}

      <form onSubmit={submitSignUp} noValidate style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
          <AuthField id="ml-name" label={a.name} icon={UserIcon} value={name} onChange={change(setName)} {...focusProps("name")} placeholder={a.name} autoComplete="name" />
          <AuthField id="ml-company" label={a.company} icon={BuildingIcon} value={company} onChange={change(setCompany)} {...focusProps("company")} placeholder={a.companyPh} autoComplete="organization" />
          <AuthField id="ml-email" label={L.email} icon={MailIcon} type="email" value={email} onChange={change(setEmail)} {...focusProps("email")} placeholder={L.emailPh} autoComplete="email" />
          <AuthField id="ml-pass" label={a.password} icon={LockIcon} type={showPw ? "text" : "password"} value={pass} onChange={change(setPass)} {...focusProps("pass")} placeholder="••••••••" autoComplete="new-password" right={eyeBtn} />
        </div>
        {err && errorStrip(err)}
        {ok && okStrip(ok)}
        <SubmitButton busy={busy} label={a.signUp} busyLabel={L.signing} withArrow={false} />
      </form>

      <div style={{ marginTop: 22, textAlign: "center", fontSize: 13.5 }}>
        <button type="button" onClick={() => go("signin")} style={linkBtn}>{a.hasAccount}</button>
      </div>
    </AuthShell>
  );
}
