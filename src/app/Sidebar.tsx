import { CSSProperties } from "react";
import { useLang, useTheme } from "./LangTheme";
import { Icon, IconName } from "./icons";
import { Logo } from "./Brand";
import type { ScreenKey } from "@/i18n/ml";

type Level = "top" | "sub";
interface NavItem { id: ScreenKey; icon: IconName; label: string; level: Level; }
interface NavSection { label?: string; items: NavItem[]; }

export function Sidebar({ active, onNavigate }: { active: ScreenKey; onNavigate: (s: ScreenKey) => void }) {
  const { t } = useLang();
  const { dark } = useTheme();
  const nav = t.nav;

  const sections: NavSection[] = [
    { items: [{ id: "dashboard", icon: "dashboard", label: nav.dashboard, level: "top" }] },
    { label: nav.secPros, items: [
      { id: "manual", icon: "database", label: nav.add, level: "top" },
      { id: "manual", icon: "plus", label: nav.manual, level: "sub" },
      { id: "gplaces", icon: "mapPin", label: nav.gplaces, level: "sub" },
      { id: "cnpj", icon: "building", label: nav.cnpj, level: "sub" },
    ] },
    { label: nav.secMgmt, items: [
      { id: "leadslist", icon: "users", label: nav.leads, level: "top" },
      { id: "score", icon: "award", label: nav.score, level: "sub" },
      { id: "timeline", icon: "clock", label: nav.timeline, level: "sub" },
      { id: "crm", icon: "trendUp", label: nav.crm, level: "top" },
      { id: "agenda", icon: "timer", label: nav.agenda, level: "top" },
      { id: "reports", icon: "chart", label: nav.reports, level: "top" },
      { id: "integrations", icon: "plug", label: nav.integrations, level: "top" },
      { id: "sub", icon: "crown", label: nav.sub, level: "top" },
      { id: "settings", icon: "settings", label: nav.settings, level: "top" },
    ] },
  ];

  return (
    <aside className="ml-scroll" style={{ width: 264, flexShrink: 0, height: "100%", display: "flex", flexDirection: "column", background: "var(--ml-sidebar)", borderRight: "1px solid var(--ml-border)", padding: "22px 16px 18px", overflowY: "auto" }}>
      {/* Logo (oficial — versão branca no tema escuro, colorida no claro) */}
      <div style={{ padding: "4px 8px 22px" }}>
        <Logo theme={dark ? "white" : "color"} height={38} />
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
                background: on ? "rgba(76,46,224,.12)" : "transparent",
                color: on ? "#4c2ee0" : "var(--ml-navtext)",
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
        <a href="tel:+16784495498" style={{ display: "flex", alignItems: "center", gap: 9, color: "inherit", textDecoration: "none" }}><Icon name="chat" size={14} /> +1 (678) 449-5498</a>
        <a href="mailto:contato@maislead.com" style={{ display: "flex", alignItems: "center", gap: 9, color: "inherit", textDecoration: "none" }}><Icon name="mail" size={14} /> contato@maislead.com</a>
        <div style={{ display: "flex", alignItems: "center", gap: 9, opacity: 0.75 }}><Icon name="clock" size={14} /> Versão 2.0.0</div>
      </div>
    </aside>
  );
}
