import { useState, type CSSProperties, type FormEvent } from "react";
import { useAuth } from "./AuthContext";
import { useLang } from "./LangTheme";
import { Icon } from "./icons";

/**
 * Tela de "Criar sua senha" — exibida quando o usuário chega por um link de
 * recovery (e-mail de convite / redefinição). Intercepta ANTES do painel: só
 * libera o acesso depois que a senha é definida com sucesso.
 * Se o link estiver expirado/inválido, mostra a mensagem e um caminho de volta.
 */
export function SetPasswordScreen() {
  const { t } = useLang();
  const { recoveryError, updatePassword, clearRecovery } = useAuth();
  const a = t.auth;

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw, setShowPw] = useState(false);
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
      // Sucesso: updatePassword baixa o flag de recovery → o app troca pro painel.
      setOk(a.pwUpdated);
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
          <div style={{ width: 52, height: 52, borderRadius: 15, background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", display: "grid", placeItems: "center", color: "#fff", boxShadow: "0 10px 24px rgba(76,46,224,.35)" }}>
            <Icon name="spark" size={26} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 12, letterSpacing: -0.4 }}>{a.brand}</div>
          <div style={{ fontSize: 13, color: "var(--ml-muted)" }}>{a.tagline}</div>
        </div>

        <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 18, padding: 26, boxShadow: "0 12px 40px rgba(30,25,70,.08)" }}>
          {expired ? (
            // ---- Link expirado / inválido ----
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, margin: "2px auto 14px", background: "rgba(239,68,68,.1)", display: "grid", placeItems: "center", color: "var(--ml-red)" }}>
                <Icon name="lock" size={24} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{a.resetTitle}</div>
              <div style={{ fontSize: 13.5, color: "var(--ml-muted)", marginTop: 8, lineHeight: 1.5 }}>{a.linkExpired}</div>
              <button onClick={clearRecovery} style={{ marginTop: 18, width: "100%", padding: "12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: "pointer", boxShadow: "0 8px 18px rgba(76,46,224,.28)" }}>
                {a.backToLogin}
              </button>
            </div>
          ) : (
            // ---- Definir nova senha ----
            <>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{a.setPwTitle}</div>
              <div style={{ fontSize: 13, color: "var(--ml-muted)", marginTop: 2, marginBottom: 18 }}>{a.setPwSub}</div>

              <form onSubmit={submit}>
                <div style={{ position: "relative", marginBottom: 14 }}>
                  <label style={label}>{a.newPassword}</label>
                  <span style={iconWrap}><Icon name="lock" size={16} /></span>
                  <input style={{ ...field, paddingRight: 40 }} type={showPw ? "text" : "password"} required value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoComplete="new-password" autoFocus />
                  <button type="button" onClick={() => setShowPw((v) => !v)} style={{ position: "absolute", right: 10, top: 32, background: "none", border: "none", color: "var(--ml-muted)", cursor: "pointer", padding: 4 }}>
                    <Icon name={showPw ? "eyeOff" : "eye"} size={16} />
                  </button>
                </div>
                <div style={{ position: "relative", marginBottom: 14 }}>
                  <label style={label}>{a.confirmPassword}</label>
                  <span style={iconWrap}><Icon name="lock" size={16} /></span>
                  <input style={field} type={showPw ? "text" : "password"} required value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
                </div>

                {err && <div style={{ fontSize: 13, color: "var(--ml-red)", background: "rgba(239,68,68,.1)", padding: "9px 12px", borderRadius: 10, marginBottom: 12 }}>{err}</div>}
                {ok && <div style={{ fontSize: 13, color: "var(--ml-green)", background: "rgba(16,185,129,.12)", padding: "9px 12px", borderRadius: 10, marginBottom: 12, display: "flex", alignItems: "center", gap: 7 }}><Icon name="check" size={15} />{ok}</div>}

                <button type="submit" disabled={busy} style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 8px 18px rgba(76,46,224,.28)" }}>
                  {busy && <Icon name="loader" size={16} className="ml-spin" />}
                  {a.setPwBtn}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
