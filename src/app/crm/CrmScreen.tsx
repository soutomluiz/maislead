import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type DragEvent as ReactDragEvent, type ReactNode } from "react";
import { useLang } from "../LangTheme";
import { useAuth } from "../AuthContext";
import { useLeads } from "../leads/useLeads";
import { LeadDrawer } from "../leads/LeadDrawer";
import { leadsI18n } from "../leads/i18n";
import {
  LeadRow, CrmStage, CRM_STAGES, CRM_STAGE_COLOR, TEMP_META,
  followInfo, FOLLOW_META, waLink, telLink, fillTemplate, hasVal,
} from "../leads/model";
import { setCrmStage } from "./data";
import type { ScreenKey } from "@/i18n/ml";

type Preset = "all" | "hot" | "score50" | "email" | "phone" | "nosite";

export function CrmScreen({ onNavigate }: { onNavigate?: (s: ScreenKey) => void }) {
  const { t, lang } = useLang();
  const { account, profile } = useAuth();
  const L = leadsI18n[lang];
  const minhaEmpresa = (profile as { company_name?: string | null })?.company_name?.trim() || (account?.name && account.name !== "Minha conta" ? account.name.trim() : "");
  const { leads: fetched, refetch } = useLeads();

  const [leads, setLeads] = useState<LeadRow[]>([]);
  useEffect(() => { setLeads(fetched); }, [fetched]);

  const [search, setSearch] = useState("");
  const [preset, setPreset] = useState<Preset>("all");
  const [openLead, setOpenLead] = useState<LeadRow | null>(null);
  const [dropTarget, setDropTarget] = useState<CrmStage | null>(null);
  const dragId = useRef<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (q) {
        const hay = `${l.company} ${l.industry ?? ""} ${l.location ?? ""} ${l.phone ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (preset === "hot") return l.temp === "hot";
      if (preset === "score50") return l.score >= 50;
      if (preset === "email") return hasVal(l.email);
      if (preset === "phone") return hasVal(l.phone);
      if (preset === "nosite") return !hasVal(l.website);
      return true;
    });
  }, [leads, search, preset]);

  async function moveTo(stage: CrmStage) {
    const id = dragId.current;
    dragId.current = null;
    setDropTarget(null);
    if (!id) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.crmStage === stage) return;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, crmStage: stage } : l)));
    try {
      await setCrmStage(id, stage, account?.id);
      refetch();
    } catch {
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, crmStage: lead.crmStage } : l)));
    }
  }

  const presets: { key: Preset; label: string }[] = [
    { key: "all", label: t.crm.presets.all }, { key: "hot", label: t.crm.presets.hot },
    { key: "score50", label: t.crm.presets.score50 }, { key: "email", label: t.crm.presets.email },
    { key: "phone", label: t.crm.presets.phone }, { key: "nosite", label: t.crm.presets.nosite },
  ];

  const waMsg = (l: LeadRow) => fillTemplate(t.wa.msg, { empresa: l.company, minhaEmpresa, setor: l.industry, cidade: l.location });

  return (
    <div className="ml-fade" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* busca */}
      <div style={{ position: "relative", marginBottom: 14, flexShrink: 0 }}>
        <span style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)", color: "#a6a3c0", display: "flex" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.crm.search}
          style={{ width: "100%", height: 48, borderRadius: 13, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", padding: "0 16px 0 42px", fontSize: 14, outline: "none", boxShadow: "0 1px 3px rgba(30,25,60,.04)" }} />
      </div>

      {/* presets + criar lead */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 8, flexShrink: 0 }}>
        {presets.map((p) => {
          const on = preset === p.key;
          return (
            <button key={p.key} onClick={() => setPreset(p.key)}
              style={{ height: 36, padding: "0 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: ".15s", background: on ? "#211d3b" : "var(--ml-card)", color: on ? "#fff" : "var(--ml-text)", border: `1px solid ${on ? "#211d3b" : "var(--ml-border)"}` }}>
              {p.label}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <button onClick={() => onNavigate?.("manual")}
          style={{ height: 38, padding: "0 18px", borderRadius: 11, border: "none", background: "#211d3b", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
          {t.crm.newLead}
        </button>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ml-muted)", marginBottom: 14, flexShrink: 0 }}>{filtered.length} {t.crm.leadsCount}</div>

      {/* colunas — a página não rola; só a lista de cards de cada coluna rola */}
      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 10, alignItems: "stretch", flex: 1, minHeight: 0 }}>
        {CRM_STAGES.map((stage) => {
          const cards = filtered.filter((l) => l.crmStage === stage);
          const isTarget = dropTarget === stage;
          return (
            <div key={stage}
              onDragOver={(e) => { e.preventDefault(); if (dropTarget !== stage) setDropTarget(stage); }}
              onDragLeave={() => setDropTarget((cur) => (cur === stage ? null : cur))}
              onDrop={(e) => { e.preventDefault(); moveTo(stage); }}
              style={{ flex: "0 0 288px", background: "var(--ml-grid)", borderRadius: 16, padding: 12, display: "flex", flexDirection: "column", minHeight: 0, maxHeight: "100%", outline: isTarget ? "2px dashed var(--ml-primary)" : "none", outlineOffset: -2 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px 12px", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: CRM_STAGE_COLOR[stage] }} />
                  {t.crm.stages[stage]}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ml-muted)", background: "var(--ml-card)", minWidth: 22, height: 22, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 7px" }}>{cards.length}</div>
              </div>
              <div className="ml-scroll" style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flex: 1, minHeight: 0, paddingRight: 3 }}>
                {cards.map((l) => (
                  <CrmCard key={l.id} lead={l} tempLabel={L[l.temp]} callLabel={t.crm.call} waLabel={t.crm.whatsapp}
                    todayLbl={t.fup.todayLbl}
                    onOpen={() => setOpenLead(l)}
                    onDragStart={(e) => { dragId.current = l.id; try { e.dataTransfer.setData("text/plain", l.id); e.dataTransfer.effectAllowed = "move"; } catch { /* ignore */ } }}
                    onDragEnd={() => { dragId.current = null; setDropTarget(null); }}
                    waHref={hasVal(l.phone) ? waLink(l.phone!, waMsg(l)) : undefined}
                    telHref={hasVal(l.phone) ? telLink(l.phone!) : undefined} />
                ))}
                {cards.length === 0 && (
                  <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--ml-muted)", padding: "24px 0" }}>{t.crm.noLeads}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {openLead && <LeadDrawer lead={openLead} onClose={() => setOpenLead(null)} onChanged={refetch} />}
    </div>
  );
}

function CrmCard({ lead, tempLabel, callLabel, waLabel, todayLbl, onOpen, onDragStart, onDragEnd, waHref, telHref }: {
  lead: LeadRow; tempLabel: string; callLabel: string; waLabel: string; todayLbl: string;
  onOpen: () => void; onDragStart: (e: ReactDragEvent) => void; onDragEnd: () => void; waHref?: string; telHref?: string;
}) {
  const tm = TEMP_META[lead.temp];
  const fi = followInfo(lead.nextFollowUpAt);
  const fm = FOLLOW_META[fi.state];
  const fuShort = fi.state === "late" ? `${fi.days}d` : fi.state === "today" ? todayLbl : `+${fi.days}d`;
  const badge = (bg: string, color: string): CSSProperties => ({ fontSize: 11, fontWeight: 800, color, background: bg, padding: "3px 8px", borderRadius: 20 });
  const stop = (e: ReactMouseEvent) => e.stopPropagation();

  return (
    <div draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onClick={onOpen}
      style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 13, padding: 13, cursor: "pointer", boxShadow: "0 1px 3px rgba(30,25,60,.05)", transition: ".15s" }}>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 7, marginBottom: 9 }}>
        <span style={badge(tm.bg, tm.color)}>{lead.score}</span>
        <span style={{ ...badge(tm.bg, tm.color), fontWeight: 700 }}>{tempLabel}</span>
        {fi.has && (
          <span title={fuShort} style={{ display: "inline-flex", alignItems: "center", gap: 4, ...badge(fm.bg, fm.color), animation: fm.pulse ? "mlFuPulse 1.4s ease-in-out infinite" : undefined }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{fuShort}
          </span>
        )}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25 }}>{lead.company}</div>
      <div style={{ fontSize: 12, color: "var(--ml-muted)", marginTop: 3, marginBottom: 11 }}>{[lead.industry, lead.location].filter(Boolean).join(" · ") || "—"}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <CardBtn href={telHref} onClick={stop} outline label={callLabel}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.94.36 1.86.7 2.73a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.35-1.27a2 2 0 012.11-.45c.87.34 1.79.57 2.73.7A2 2 0 0122 16.92z" /></svg>
        </CardBtn>
        <CardBtn href={waHref} onClick={stop} label={waLabel}>{null}</CardBtn>
      </div>
    </div>
  );
}

function CardBtn({ href, onClick, outline, label, children }: { href?: string; onClick: (e: ReactMouseEvent) => void; outline?: boolean; label: string; children: ReactNode }) {
  const style: CSSProperties = {
    flex: 1, height: 34, borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: href ? "pointer" : "not-allowed",
    display: "flex", alignItems: "center", justifyContent: "center", gap: 5, textDecoration: "none", opacity: href ? 1 : 0.45,
    border: outline ? "1px solid var(--ml-border)" : "1px solid rgba(16,185,129,.3)",
    background: outline ? "var(--ml-card)" : "rgba(16,185,129,.08)",
    color: outline ? "var(--ml-text)" : "#059669",
  };
  if (!href) return <div style={style}>{children}{label}</div>;
  return <a href={href} target="_blank" rel="noreferrer" onClick={onClick} style={style}>{children}{label}</a>;
}
