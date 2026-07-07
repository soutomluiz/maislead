import { CSSProperties } from "react";
import { useLang } from "./LangTheme";
import { Icon, IconName } from "./icons";
import type { ScreenKey } from "@/i18n/ml";

interface NavItem { id: ScreenKey; icon: IconName; labelKey: string; }
interface NavSection { label?: string; items: NavItem[]; }

export function Sidebar({ active, onNavigate }: { active: ScreenKey; onNavigate: (s: ScreenKey) => void }) {
  const { t } = useLang();
  const nav = t.nav;

  const sections: NavSection[] = [
    { items: [{ id: "dashboard", icon: "dashboard", labelKey: "dashboard" }] },
    { label: nav.secPros, items: [
      { id: "manual", icon: "plus", labelKey: "manual" },
      { id: "gplaces", icon: "mapPin", labelKey: "gplaces" },
      { id: "websites", icon: "globe", labelKey: "websites" },
    ] },
    { label: nav.secMgmt, items: [
      { id: "leadslist", icon: "users", labelKey: "leads" },
      { id: "score", icon: "award", labelKey: "score" },
      { id: "timeline", icon: "timer", labelKey: "timeline" },
    ] },
    { items: [
      { id: "reports", icon: "chart", labelKey: "reports" },
      { id: "integrations", icon: "plug", labelKey: "integrations" },
      { id: "sub", icon: "crown", labelKey: "sub" },
      { id: "settings", icon: "settings", labelKey: "settings" },
    ] },
  ];

  return (
    <aside style={{ width: 244, flexShrink: 0, background: "var(--ml-sidebar)", borderRight: "1px solid var(--ml-border)", height: "100vh", position: "sticky", top: 0, display: "flex", flexDirection: "column", padding: "18px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "4px 8px 20px" }}>
        <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", display: "grid", placeItems: "center", color: "#fff", boxShadow: "0 6px 14px rgba(109,92,245,.3)" }}>
          <Icon name="plus" size={20} />
        </div>
        <div style={{ lineHeight: 1.05 }}>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.4 }}><span style={{ fontWeight: 600 }}>mais</span>LEAD</div>
          <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.6, color: "var(--ml-muted)", marginTop: 3 }}>PROSPECÇÃO</div>
        </div>
      </div>

      <nav className="ml-scroll" style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {sections.map((sec, i) => (
          <div key={i} style={{ marginTop: sec.label ? 12 : 4 }}>
            {sec.label && <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--ml-muted)", padding: "4px 10px 6px" }}>{sec.label}</div>}
            {sec.items.map((it) => {
              const on = active === it.id;
              const style: CSSProperties = {
                display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "10px 11px",
                borderRadius: 11, cursor: "pointer", fontSize: 14, fontWeight: 500, border: "none", textAlign: "left",
                transition: ".15s",
                background: on ? "rgba(109,92,245,.12)" : "transparent",
                color: on ? "var(--ml-primary)" : "var(--ml-navtext)",
              };
              return (
                <button key={it.id} style={style} onClick={() => onNavigate(it.id)}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--ml-hover)"; }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                  <Icon name={it.icon} size={18} />
                  <span>{(nav as Record<string, string>)[it.labelKey]}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ paddingTop: 14, marginTop: 8, borderTop: "1px solid var(--ml-border)", display: "flex", flexDirection: "column", gap: 8, fontSize: 11.5, color: "var(--ml-muted)" }}>
        <a href="tel:+551140028922" style={{ display: "flex", alignItems: "center", gap: 8, color: "inherit", textDecoration: "none" }}><Icon name="chat" size={13} /> (11) 4002-8922</a>
        <a href="mailto:contato@maislead.com.br" style={{ display: "flex", alignItems: "center", gap: 8, color: "inherit", textDecoration: "none" }}><Icon name="mail" size={13} /> contato@maislead.com.br</a>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon name="timer" size={13} /> Versão 2.0.0</div>
      </div>
    </aside>
  );
}
