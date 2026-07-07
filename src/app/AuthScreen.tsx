import { useState, type CSSProperties, type FormEvent } from "react";
import { useAuth } from "./AuthContext";
import { useLang } from "./LangTheme";
import { Icon } from "./icons";

type Mode = "signin" | "signup" | "reset";

export function AuthScreen() {
  const { t } = useLang();
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const a = t.auth;
  const heading = mode === "signin" ? [a.signInTitle, a.signInSub] : mode === "signup" ? [a.signUpTitle, a.signUpSub] : [a.resetTitle, a.resetSub];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null); setOk(null); setBusy(true);
    try {
      if (mode === "signin") {
        const r = await signIn(email, password);
        if (r.error) setErr(r.error);
      } else if (mode === "signup") {
        const r = await signUp(name, email, password);
        if (r.error) setErr(r.error);
        else if (r.needsConfirm) { setOk(a.checkEmail); setMode("signin"); }
      } else {
        const r = await resetPassword(email);
        if (r.error) setErr(r.error);
        else setOk(a.resetSent);
      }
    } finally { setBusy(false); }
  }

  const label: CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "var(--ml-navtext)", marginBottom: 6, display: "block" };
  const field: CSSProperties = {
    width: "100%", padding: "11px 12px 11px 40px", borderRadius: 11,
    border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)",
    fontSize: 14, outline: "none",
  };
  const iconWrap: CSSProperties = { position: "absolute", left: 12, top: 34, color: "var(--ml-muted)" };

  return (
    <div className="ml-root ml-fade" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* brand */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 22 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", display: "grid", placeItems: "center", color: "#fff", boxShadow: "0 10px 24px rgba(109,92,245,.35)" }}>
            <Icon name="spark" size={26} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 12, letterSpacing: -0.4 }}>{a.brand}</div>
          <div style={{ fontSize: 13, color: "var(--ml-muted)" }}>{a.tagline}</div>
        </div>

        <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 18, padding: 26, boxShadow: "0 12px 40px rgba(30,25,70,.08)" }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{heading[0]}</div>
          <div style={{ fontSize: 13, color: "var(--ml-muted)", marginTop: 2, marginBottom: 18 }}>{heading[1]}</div>

          <form onSubmit={submit}>
            {mode === "signup" && (
              <div style={{ position: "relative", marginBottom: 14 }}>
                <label style={label}>{a.name}</label>
                <span style={iconWrap}><Icon name="user" size={16} /></span>
                <input style={field} value={name} onChange={(e) => setName(e.target.value)} placeholder={a.name} autoComplete="name" />
              </div>
            )}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <label style={label}>{a.email}</label>
              <span style={iconWrap}><Icon name="mail" size={16} /></span>
              <input style={field} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com" autoComplete="email" />
            </div>
            {mode !== "reset" && (
              <div style={{ position: "relative", marginBottom: 14 }}>
                <label style={label}>{a.password}</label>
                <span style={iconWrap}><Icon name="lock" size={16} /></span>
                <input style={{ ...field, paddingRight: 40 }} type={showPw ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
                <button type="button" onClick={() => setShowPw((v) => !v)} style={{ position: "absolute", right: 10, top: 32, background: "none", border: "none", color: "var(--ml-muted)", cursor: "pointer", padding: 4 }}>
                  <Icon name={showPw ? "eyeOff" : "eye"} size={16} />
                </button>
              </div>
            )}

            {err && <div style={{ fontSize: 13, color: "var(--ml-red)", background: "rgba(239,68,68,.1)", padding: "9px 12px", borderRadius: 10, marginBottom: 12 }}>{err}</div>}
            {ok && <div style={{ fontSize: 13, color: "var(--ml-green)", background: "rgba(16,185,129,.12)", padding: "9px 12px", borderRadius: 10, marginBottom: 12 }}>{ok}</div>}

            <button type="submit" disabled={busy} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 8px 18px rgba(109,92,245,.28)" }}>
              {busy && <Icon name="loader" size={16} className="ml-spin" />}
              {mode === "signin" ? a.signIn : mode === "signup" ? a.signUp : a.sendReset}
            </button>
          </form>

          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8, alignItems: "center", fontSize: 13 }}>
            {mode === "signin" && (
              <>
                <button onClick={() => { setMode("reset"); setErr(null); setOk(null); }} style={linkBtn}>{a.forgot}</button>
                <button onClick={() => { setMode("signup"); setErr(null); setOk(null); }} style={linkBtn}>{a.noAccount}</button>
              </>
            )}
            {mode === "signup" && <button onClick={() => { setMode("signin"); setErr(null); setOk(null); }} style={linkBtn}>{a.hasAccount}</button>}
            {mode === "reset" && <button onClick={() => { setMode("signin"); setErr(null); setOk(null); }} style={linkBtn}>{a.backToLogin}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

const linkBtn: CSSProperties = { background: "none", border: "none", color: "var(--ml-primary)", cursor: "pointer", fontWeight: 600, fontSize: 13 };
