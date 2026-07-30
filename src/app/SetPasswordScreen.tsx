import { useState, type CSSProperties, type FormEvent } from "react";
import { useAuth } from "./AuthContext";
import { useLang } from "./LangTheme";
import { AuthShell, FormLogo, authLabel, fieldBorder, fieldBg, iconColor } from "./AuthLayout";

/**
 * "Criar sua senha" — exibida quando o usuário chega por um link de recovery
 * (convite / redefinição). Intercepta ANTES do painel: só libera o acesso
 * depois que a senha é definida. Se o link expirou, mostra o caminho de volta.
 * Mesma linguagem visual do login (painel de marca à esquerda).
 */

const LockIcon = (c: string) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2.5" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);
const EyeSvg = (open: boolean) =>
  open ? (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8f8ba8" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-8-10-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" /><path d="m1 1 22 22" /></svg>
  ) : (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8f8ba8" strokeWidth="2"><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" /><circle cx="12" cy="12" r="3" /></svg>
  );

const inputBase = (focused: boolean, filled: boolean, hasRight: boolean): CSSProperties => ({
  width: "100%", height: 50, border: `1.5px solid ${fieldBorder(focused, filled)}`, background: fieldBg(focused),
  borderRadius: 13, padding: hasRight ? "0 46px 0 42px" : "0 14px 0 42px", fontSize: 14.5, color: "#211d3b", outline: "none",
});

const submitBtn: CSSProperties = {
  width: "100%", height: 52, marginTop: 20, border: "none", borderRadius: 14,
  background: "linear-gradient(140deg,#5b3ae8,#4c2ee0 55%,#3f24c4)", color: "#fff", fontSize: 15, fontWeight: 800,
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, boxShadow: "0 8px 22px rgba(76,46,224,.3)",
};

export function SetPasswordScreen() {
  const { t } = useLang();
  const { recoveryError, updatePassword, clearRecovery } = useAuth();
  const a = t.auth;

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [focus, setFocus] = useState<"pw" | "pw2" | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const expired = !!recoveryError;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) { setErr(a.pwMin); return; }
    if (pw !== pw2) { setErr(a.pwMismatch); return; }
    setBusy(true);
    try {
      const r = await updatePassword(pw);
      if (r.error) { setErr(r.error); return; }
      setOk(a.pwUpdated); // updatePassword baixa o flag de recovery → app troca pro painel
    } finally { setBusy(false); }
  }

  const eyeBtn = (
    <button type="button" onClick={() => setShowPw((v) => !v)} className="mla-eye"
      style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", width: 36, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: "transparent", border: "none" }}>
      {EyeSvg(showPw)}
    </button>
  );

  return (
    <AuthShell variant="welcome">
      <FormLogo />

      {expired ? (
        /* ── link expirado / inválido ── */
        <div>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(244,63,94,.09)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c81e42", marginBottom: 16 }}>
            {LockIcon("#c81e42")}
          </div>
          <div style={{ fontSize: 29, fontWeight: 800, letterSpacing: "-.028em", lineHeight: 1.2 }}>{a.resetTitle}</div>
          <div style={{ fontSize: 14.5, color: "#6f6a8c", marginTop: 9, fontWeight: 500, lineHeight: 1.55 }}>{a.linkExpired}</div>
          <button type="button" onClick={clearRecovery} className="mla-submit" style={submitBtn}>{a.backToLogin}</button>
        </div>
      ) : (
        /* ── definir nova senha ── */
        <>
          <div>
            <div style={{ fontSize: 29, fontWeight: 800, letterSpacing: "-.028em", lineHeight: 1.2 }}>{a.setPwTitle}</div>
            <div style={{ fontSize: 14.5, color: "#6f6a8c", marginTop: 9, fontWeight: 500, lineHeight: 1.55 }}>{a.setPwSub}</div>
          </div>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 24 }}>
              <div>
                <label htmlFor="ml-pw" style={authLabel}>{a.newPassword}</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", display: "flex" }}>{LockIcon(iconColor(focus === "pw"))}</span>
                  <input id="ml-pw" type={showPw ? "text" : "password"} value={pw} autoFocus autoComplete="new-password" placeholder="••••••••"
                    onChange={(e) => { setPw(e.target.value); setErr(null); }} onFocus={() => setFocus("pw")} onBlur={() => setFocus(null)}
                    style={inputBase(focus === "pw", !!pw, true)} />
                  {eyeBtn}
                </div>
              </div>
              <div>
                <label htmlFor="ml-pw2" style={authLabel}>{a.confirmPassword}</label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", display: "flex" }}>{LockIcon(iconColor(focus === "pw2"))}</span>
                  <input id="ml-pw2" type={showPw ? "text" : "password"} value={pw2} autoComplete="new-password" placeholder="••••••••"
                    onChange={(e) => { setPw2(e.target.value); setErr(null); }} onFocus={() => setFocus("pw2")} onBlur={() => setFocus(null)}
                    style={inputBase(focus === "pw2", !!pw2, false)} />
                </div>
              </div>
            </div>

            {err && (
              <div className="mla-erroir" style={{ marginTop: 16, background: "rgba(244,63,94,.07)", border: "1px solid #f6d3d9", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, fontWeight: 600, color: "#c81e42" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e11d48" strokeWidth="2.2" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                <span>{err}</span>
              </div>
            )}
            {ok && (
              <div className="mla-erroir" style={{ marginTop: 16, background: "rgba(16,185,129,.08)", border: "1px solid #bfe9d6", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "#0f9d6b" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0f9d6b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                <span>{ok}</span>
              </div>
            )}

            <button type="submit" disabled={busy} className="mla-submit" style={submitBtn}>
              {busy ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <span className="mla-spinner" style={{ width: 16, height: 16, borderRadius: "50%", border: "2.2px solid rgba(255,255,255,.35)", borderTopColor: "#fff", display: "inline-block" }} />
                  {a.pwUpdated}
                </span>
              ) : a.setPwBtn}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
