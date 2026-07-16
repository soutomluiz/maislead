import { useMemo, useState, type ReactNode } from "react";
import { useLang } from "./LangTheme";
import { Icon } from "./icons";
import { useLeads } from "./leads/useLeads";
import { LeadRow, TEMP_META, hasVal } from "./leads/model";
import { LeadDrawer } from "./leads/LeadDrawer";
import type { Temperature } from "@/lib/score";

const DICT = {
  pt: { all: "Todos", hot: "Quentes", warm: "Mornos", cool: "Frios", tHot: "Quente", tWarm: "Morno", tCool: "Frio", noLeads: "Nenhum lead", industry: "Indústria não especificada", cPhone: "Telefone", cEmail: "Email", cSite: "Site" },
  en: { all: "All", hot: "Hot", warm: "Warm", cool: "Cool", tHot: "Hot", tWarm: "Warm", tCool: "Cool", noLeads: "No leads", industry: "Unspecified industry", cPhone: "Phone", cEmail: "Email", cSite: "Site" },
  es: { all: "Todos", hot: "Calientes", warm: "Tibios", cool: "Fríos", tHot: "Caliente", tWarm: "Tibio", tCool: "Frío", noLeads: "Sin leads", industry: "Industria no especificada", cPhone: "Teléfono", cEmail: "Email", cSite: "Sitio" },
};
const TEMP_LABEL = { hot: "tHot", warm: "tWarm", cool: "tCool" } as const;
const DOT: Record<string, string> = { hot: "var(--ml-red)", warm: "var(--ml-amber)", cool: "var(--ml-primary)" };

export function ScoreScreen() {
  const { lang } = useLang();
  const D = DICT[lang];
  const { leads, loading, error, refetch } = useLeads();
  const [filter, setFilter] = useState<Temperature | "all">("all");
  const [open, setOpen] = useState<LeadRow | null>(null);

  const sorted = useMemo(() => [...leads].sort((a, b) => b.score - a.score), [leads]);
  const list = filter === "all" ? sorted : sorted.filter((l) => l.temp === filter);

  if (loading) return <Center><Icon name="loader" size={26} className="ml-spin" style={{ color: "var(--ml-primary)" }} /></Center>;
  if (error) return <Center><span style={{ color: "var(--ml-red)", fontSize: 14 }}>{error}</span></Center>;

  const filters: [Temperature | "all", string][] = [["all", D.all], ["hot", D.hot], ["warm", D.warm], ["cool", D.cool]];

  return (
    <div className="ml-fade">
      <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
        {filters.map(([k, lbl]) => {
          const on = filter === k;
          return <button key={k} onClick={() => setFilter(k)} style={{ height: 38, padding: "0 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, border: `1px solid ${on ? "#4c2ee0" : "var(--ml-border)"}`, background: on ? "#4c2ee0" : "var(--ml-card)", color: on ? "#fff" : "var(--ml-text)" }}>
            {k !== "all" && <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? "#fff" : DOT[k] }} />}{lbl}
          </button>;
        })}
      </div>

      {list.length === 0 ? <Center><span style={{ color: "var(--ml-muted)" }}>{D.noLeads}</span></Center> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 }}>
          {list.map((l) => {
            const tm = TEMP_META[l.temp];
            return (
              <div key={l.id} onClick={() => setOpen(l)} style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 18, padding: 20, cursor: "pointer", boxShadow: "0 1px 3px rgba(30,25,60,.04)", transition: ".15s" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 26px rgba(76,46,224,.14)"; e.currentTarget.style.borderColor = "#c9bffb"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(30,25,60,.04)"; e.currentTarget.style.borderColor = "var(--ml-border)"; }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25 }}>{l.company}</div>
                    <div style={{ fontSize: 12, color: "var(--ml-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.industry || D.industry}</div>
                  </div>
                  <div style={{ textAlign: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: tm.color, lineHeight: 1 }}>{l.score}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: tm.color, marginTop: 3 }}>{D[TEMP_LABEL[l.temp]]}</div>
                  </div>
                </div>
                <div style={{ height: 7, borderRadius: 5, background: "var(--ml-grid)", overflow: "hidden", margin: "14px 0" }}>
                  <div style={{ height: "100%", width: `${l.score}%`, background: tm.color, borderRadius: 5 }} />
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Chip on={hasVal(l.phone)} icon="phone" label={D.cPhone} />
                  <Chip on={hasVal(l.email)} icon="mail" label={D.cEmail} />
                  <Chip on={hasVal(l.website)} icon="globe" label={D.cSite} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <LeadDrawer lead={open} onClose={() => setOpen(null)} onChanged={refetch} />
    </div>
  );
}

function Chip({ on, icon, label }: { on: boolean; icon: "phone" | "mail" | "globe"; label: string }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: on ? "rgba(16,185,129,.12)" : "var(--ml-grid)", color: on ? "var(--ml-green)" : "var(--ml-muted)" }}>
      <Icon name={icon} size={13} />{label}
    </span>
  );
}

function Center({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", placeItems: "center", minHeight: 260 }}>{children}</div>;
}
