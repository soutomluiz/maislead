import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useLang } from "./LangTheme";
import { Logo } from "./Brand";
import type { Lang } from "@/i18n/ml";
import "./auth.css";

/* ─────────────────────────── ícones (fiéis ao .dc.html) ─────────────────────────── */

export function GoogleIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.27-4.74 3.27-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

/* ─────────────────────────── painel de marca (esquerda) ─────────────────────────── */

export function BrandPane({ variant = "login" }: { variant?: "login" | "welcome" }) {
  const { t } = useLang();
  const L = t.login;
  const W = L.welcome;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 3600);
    return () => clearInterval(iv);
  }, []);

  const item = L.ticker[tick % L.ticker.length];

  return (
    <div
      className="mla-brandpane"
      style={{
        width: "47%", maxWidth: 660, flexShrink: 0,
        background: "radial-gradient(120% 90% at 15% 5%,#5b3ae8 0%,#3a1fb0 42%,#1e1150 100%)",
        color: "#fff", padding: "44px 52px 40px", display: "flex", flexDirection: "column",
        position: "relative", overflow: "hidden",
      }}
    >
      {/* camadas decorativas */}
      <div className="mla-drift" style={{ position: "absolute", top: -160, right: -140, width: 440, height: 440, borderRadius: "50%", background: "radial-gradient(circle,rgba(160,130,255,.28) 0%,rgba(160,130,255,0) 70%)" }} />
      <div className="mla-drift-rev" style={{ position: "absolute", bottom: -120, left: -100, width: 340, height: 340, borderRadius: "50%", background: "radial-gradient(circle,rgba(90,220,190,.16) 0%,rgba(90,220,190,0) 70%)" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px)", backgroundSize: "58px 58px", WebkitMaskImage: "radial-gradient(90% 70% at 40% 30%,#000 20%,transparent 78%)", maskImage: "radial-gradient(90% 70% at 40% 30%,#000 20%,transparent 78%)" }} />

      <div className="sl" style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1 }}>
        {/* 1 · logo (versão branca — fundo roxo) */}
        <div>
          <Logo theme="white" height={40} />
        </div>

        {variant === "welcome" ? (
          <>
            {/* 2 · boas-vindas: badge + headline + sub (empurrado pra baixo) */}
            <div style={{ marginTop: "auto", paddingTop: 48 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(52,211,153,.14)", border: "1px solid rgba(52,211,153,.34)", padding: "7px 14px 7px 11px", borderRadius: 30, fontSize: 12.5, fontWeight: 700, letterSpacing: ".01em", color: "#a7f3d0" }}>
                <span className="mla-livedot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399" }} />
                {W.badge}
              </div>
              <div style={{ fontSize: 41, lineHeight: 1.14, fontWeight: 800, letterSpacing: "-.028em", marginTop: 22, maxWidth: "9.5em" }}>
                {W.headA}<br />
                <span style={{ background: "linear-gradient(96deg,#fff 20%,#c2aeff 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>{W.headB}</span>
              </div>
              <div style={{ fontSize: 15.5, lineHeight: 1.6, color: "rgba(255,255,255,.72)", marginTop: 16, maxWidth: "30em", fontWeight: 500 }}>{W.sub}</div>
            </div>

            {/* 3 · primeiros passos (card, no lugar do ticker) */}
            <div style={{ marginTop: 34, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.13)", borderRadius: 17, padding: "18px 18px 16px", backdropFilter: "blur(10px)" }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.5)" }}>{W.stepsLabel}</div>
              <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 13 }}>
                {W.steps.map(([title, detail], i) => {
                  const active = i === 0;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800, background: active ? "rgba(52,211,153,.18)" : "rgba(255,255,255,.08)", border: `1px solid ${active ? "rgba(52,211,153,.5)" : "rgba(255,255,255,.14)"}`, color: active ? "#34d399" : "rgba(255,255,255,.65)" }}>
                        {active ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg> : i + 1}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff" }}>{title}</div>
                        <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.56)", fontWeight: 600, marginTop: 1 }}>{detail}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 2 · badge + headline + sub (empurrado pra baixo) */}
            <div style={{ marginTop: "auto", paddingTop: 48 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.16)", padding: "7px 14px 7px 11px", borderRadius: 30, fontSize: 12.5, fontWeight: 700, letterSpacing: ".01em" }}>
                <span className="mla-livedot" style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399" }} />
                {L.badge}
              </div>
              <div style={{ fontSize: 41, lineHeight: 1.14, fontWeight: 800, letterSpacing: "-.028em", marginTop: 22, maxWidth: "9.5em" }}>
                {L.headA}<br />
                <span style={{ background: "linear-gradient(96deg,#fff 20%,#c2aeff 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" }}>{L.headB}</span>
              </div>
              <div style={{ fontSize: 15.5, lineHeight: 1.6, color: "rgba(255,255,255,.72)", marginTop: 16, maxWidth: "30em", fontWeight: 500 }}>{L.brandSub}</div>
            </div>

            {/* 3 · ticker */}
            <div style={{ marginTop: 34, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.13)", borderRadius: 17, padding: "16px 18px", backdropFilter: "blur(10px)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.5)" }}>{L.tickerLabel}</div>
                <span className="mla-livedot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399" }} />
              </div>
              <div style={{ height: 40, position: "relative", marginTop: 11, overflow: "hidden" }}>
                <div key={`${tick}-${item[0]}`} className="mla-tickitem" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,255,255,.13)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#c2aeff" strokeWidth="2.2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item[0]}</div>
                    <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.58)", fontWeight: 600, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item[1]}</div>
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 800, color: "#34d399", background: "rgba(16,185,129,.14)", padding: "5px 10px", borderRadius: 8, whiteSpace: "nowrap", flexShrink: 0 }}>{item[2]}</div>
                </div>
              </div>
            </div>

            {/* 4 · provas */}
            <div style={{ marginTop: 26, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {L.proofs.map(([num, label], i) => (
                <div key={i} style={{ borderLeft: "2px solid rgba(194,174,255,.5)", paddingLeft: 13 }}>
                  <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: "-.02em" }}>{num}</div>
                  <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.6)", fontWeight: 600, lineHeight: 1.35, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 5 · rodapé de confiança */}
        <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 13, fontSize: 12.5, color: "rgba(255,255,255,.52)", fontWeight: 600 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="2.2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            {L.dataProtected}
          </span>
          <span style={{ width: 1, height: 12, background: "rgba(255,255,255,.2)" }} />
          <span>{L.lgpd}</span>
          <span style={{ width: 1, height: 12, background: "rgba(255,255,255,.2)" }} />
          <span>{L.domain}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── seletor de idioma (PT/EN/ES) ─────────────────────────── */

export function LangSwitch() {
  const { lang, setLang } = useLang();
  const langs: [Lang, string][] = [["pt", "PT"], ["en", "EN"], ["es", "ES"]];
  return (
    <div style={{ display: "flex", background: "#f2f0fa", borderRadius: 9, padding: 3, gap: 2 }}>
      {langs.map(([code, label]) => {
        const on = lang === code;
        return (
          <button
            key={code}
            type="button"
            onClick={() => setLang(code)}
            className="mla-lang"
            style={{
              padding: "5px 11px", borderRadius: 7, fontSize: 11.5, fontWeight: 800, letterSpacing: ".03em",
              cursor: "pointer", border: "none",
              background: on ? "#fff" : "transparent", color: on ? "#4c2ee0" : "#8f8ba8",
              boxShadow: on ? "0 1px 3px rgba(40,25,90,.12)" : "none",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── shell de duas colunas ─────────────────────────── */

export function AuthShell({ children, variant = "login" }: { children: ReactNode; variant?: "login" | "welcome" }) {
  const { t } = useLang();
  const L = t.login;
  return (
    <div className="ml-auth">
      <BrandPane variant={variant} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "26px 32px 32px", background: "#fdfcff", minWidth: 0 }}>
        <div className="mla-fadein" style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <LangSwitch />
        </div>

        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 0" }}>
          <div className="st" style={{ width: "100%", maxWidth: 404 }}>{children}</div>
        </div>

        <div className="mla-fadein-late" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, fontSize: 11.5, color: "#a6a3c0", fontWeight: 600 }}>
          <a href="#" style={{ color: "#a6a3c0" }}>{L.terms}</a>
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#d6d2e6" }} />
          <a href="#" style={{ color: "#a6a3c0" }}>{L.privacy}</a>
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#d6d2e6" }} />
          <a href="#" style={{ color: "#a6a3c0" }}>{L.support}</a>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── logo compacto do form (reuso) ─────────────────────────── */

export function FormLogo() {
  return (
    <div style={{ marginBottom: 22 }}>
      <Logo theme="color" height={100} />
    </div>
  );
}

/* estilos de campo compartilhados (label + input com ícone) */
export const authLabel: CSSProperties = { fontSize: 12.5, fontWeight: 700, color: "#4b4767", display: "block", marginBottom: 7 };

export function fieldBorder(focused: boolean, filled: boolean): string {
  return focused ? "#4c2ee0" : filled ? "#d9d4ee" : "#e4e1f0";
}
export function fieldBg(focused: boolean): string {
  return focused ? "#fff" : "#f8f7fd";
}
export function iconColor(focused: boolean): string {
  return focused ? "#4c2ee0" : "#a6a3c0";
}
