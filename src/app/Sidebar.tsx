import { CSSProperties } from "react";
import { useLang } from "./LangTheme";
import { Icon, IconName } from "./icons";
import type { ScreenKey } from "@/i18n/ml";

type Level = "top" | "sub";
interface NavItem { id: ScreenKey; icon: IconName; label: string; level: Level; }
interface NavSection { label?: string; items: NavItem[]; }

export function Sidebar({ active, onNavigate }: { active: ScreenKey; onNavigate: (s: ScreenKey) => void }) {
  const { t } = useLang();
  const nav = t.nav;

  const sections: NavSection[] = [
    { items: [{ id: "dashboard", icon: "dashboard", label: nav.dashboard, level: "top" }] },
    { label: nav.secPros, items: [
      { id: "manual", icon: "database", label: nav.add, level: "top" },
      { id: "manual", icon: "plus", label: nav.manual, level: "sub" },
      { id: "gplaces", icon: "mapPin", label: nav.gplaces, level: "sub" },
      { id: "websites", icon: "globe", label: nav.websites, level: "sub" },
    ] },
    { label: nav.secMgmt, items: [
      { id: "leadslist", icon: "users", label: nav.leads, level: "top" },
      { id: "score", icon: "award", label: nav.score, level: "sub" },
      { id: "timeline", icon: "clock", label: nav.timeline, level: "sub" },
      { id: "reports", icon: "chart", label: nav.reports, level: "top" },
      { id: "integrations", icon: "plug", label: nav.integrations, level: "top" },
      { id: "sub", icon: "crown", label: nav.sub, level: "top" },
      { id: "settings", icon: "settings", label: nav.settings, level: "top" },
    ] },
  ];

  return (
    <aside className="ml-scroll" style={{ width: 264, flexShrink: 0, height: "100%", display: "flex", flexDirection: "column", background: "var(--ml-sidebar)", borderRight: "1px solid var(--ml-border)", padding: "22px 16px 18px", overflowY: "auto" }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 22px" }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg,#6d5cf5,#9d7bff)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", boxShadow: "0 6px 16px rgba(109,92,245,.35)" }}>
          <Icon name="plus" size={20} strokeWidth={2.4} />
        </div>
        <div style={{ lineHeight: 1 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.02em" }}>mais<span style={{ color: "#6d5cf5" }}>LEAD</span></div>
          <div style={{ fontSize: 10, fontWeight: 600, color: "var(--ml-muted)", letterSpacing: ".14em", marginTop: 3 }}>PROSPECÇÃO</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1 }}>
        {sections.map((sec, si) => (
          <div key={si} style={{ display: "contents" }}>
            {sec.label && (
              <div style={{ marginTop: si === 1 ? 8 : 12, padding: "0 12px 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "var(--ml-muted)", textTransform: "uppercase" }}>{sec.label}</div>
            )}
            {sec.items.map((it, ii) => {
              const on = active === it.id;
              const sub = it.level === "sub";
              const style: CSSProperties = {
                display: "flex", alignItems: "center", gap: sub ? 11 : 12,
                padding: sub ? "9px 12px 9px 30px" : "11px 12px",
                borderRadius: sub ? 11 : 12, cursor: "pointer", width: "100%", border: "none", textAlign: "left",
                fontSize: sub ? 13.5 : 14, fontWeight: 500, transition: ".15s",
                background: on ? "rgba(109,92,245,.12)" : "transparent",
                color: on ? "#6d5cf5" : "var(--ml-navtext)",
              };
              return (
                <button key={`${si}-${ii}`} style={style} onClick={() => onNavigate(it.id)}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--ml-hover)"; }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                  <Icon name={it.icon} size={sub ? 16 : 18} />
                  <span>{it.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ marginTop: 14, padding: "14px 12px 4px", borderTop: "1px solid var(--ml-border)", display: "flex", flexDirection: "column", gap: 9, fontSize: 12, color: "var(--ml-muted)" }}>
        <a href="tel:+551140028922" style={{ display: "flex", alignItems: "center", gap: 9, color: "inherit", textDecoration: "none" }}><Icon name="chat" size={14} /> (11) 4002-8922</a>
        <a href="mailto:contato@maislead.com.br" style={{ display: "flex", alignItems: "center", gap: 9, color: "inherit", textDecoration: "none" }}><Icon name="mail" size={14} /> contato@maislead.com.br</a>
        <div style={{ display: "flex", alignItems: "center", gap: 9, opacity: 0.75 }}><Icon name="clock" size={14} /> Versão 2.0.0</div>
      </div>
    </aside>
  );
}
