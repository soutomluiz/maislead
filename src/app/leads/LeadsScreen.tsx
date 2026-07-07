import { useEffect, useMemo, useState, CSSProperties } from "react";
import { useLang } from "../LangTheme";
import { useAuth } from "../AuthContext";
import { Icon } from "../icons";
import { getPerPage, getExportFormat, type ExportFormat } from "../prefs";
import { leadsI18n } from "./i18n";
import { useLeads, updateLeadStatus } from "./useLeads";
import { LeadRow, LeadStatus, STATUS_META, TEMP_META, hasVal } from "./model";
import { LeadDrawer } from "./LeadDrawer";
import { MassEmailModal } from "./MassEmailModal";
import { ImportCsvModal } from "./ImportCsvModal";
import type { Temperature } from "@/lib/score";

const XT = {
  pt: { import: "Importar", massEmail: "E-mail em massa", total: "Total de Leads", tags: "Tags", loc: "Localização", prev: "Anterior", next: "Próximo" },
  en: { import: "Import", massEmail: "Mass email", total: "Total Leads", tags: "Tags", loc: "Location", prev: "Previous", next: "Next" },
  es: { import: "Importar", massEmail: "Email masivo", total: "Total de Leads", tags: "Tags", loc: "Ubicación", prev: "Anterior", next: "Siguiente" },
};

function exportLeads(rows: LeadRow[], format: ExportFormat) {
  const stamp = new Date().toISOString().slice(0, 10);
  let blob: Blob, ext: string;
  if (format === "json") {
    const data = rows.map((r) => ({ empresa: r.company, contato: r.contact, industria: r.industry, localizacao: r.location, telefone: r.phone, email: r.email, website: r.website, endereco: r.address, status: r.status, score: r.score, tags: r.tags }));
    blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8;" });
    ext = "json";
  } else {
    const headers = ["Empresa", "Contato", "Industria", "Localizacao", "Telefone", "Email", "Website", "Endereco", "Status", "Score", "Tags"];
    const esc = (v: unknown) => `"${(v == null ? "" : String(v)).replace(/"/g, '""')}"`;
    const lines = [headers.join(",")];
    for (const r of rows) lines.push([r.company, r.contact, r.industry, r.location, r.phone, r.email, r.website, r.address, r.status, r.score, r.tags.join("; ")].map(esc).join(","));
    blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    ext = "csv";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `leads_${stamp}.${ext}`; a.click();
  URL.revokeObjectURL(url);
}

export function LeadsScreen() {
  const { lang } = useLang();
  const { account, session } = useAuth();
  const L = leadsI18n[lang];
  const X = XT[lang];
  const { leads, loading, error, refetch } = useLeads();
  const [emailOpen, setEmailOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState<LeadStatus | "all">("all");
  const [fIndustry, setFIndustry] = useState<string>("all");
  const [fTemp, setFTemp] = useState<Temperature | "all">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openLead, setOpenLead] = useState<LeadRow | null>(null);
  const perPage = getPerPage();
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [q, fStatus, fIndustry, fTemp]);

  const industries = useMemo(() => Array.from(new Set(leads.map((l) => l.industry).filter(Boolean))) as string[], [leads]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (fStatus !== "all" && l.status !== fStatus) return false;
      if (fIndustry !== "all" && l.industry !== fIndustry) return false;
      if (fTemp !== "all" && l.temp !== fTemp) return false;
      if (term) {
        const hay = `${l.company} ${l.contact ?? ""} ${l.phone ?? ""} ${l.email ?? ""} ${l.location ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [leads, q, fStatus, fIndustry, fTemp]);

  const activeFilters = (fStatus !== "all" ? 1 : 0) + (fIndustry !== "all" ? 1 : 0) + (fTemp !== "all" ? 1 : 0);
  const allOn = filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  const selCount = selected.size;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, totalPages);
  const paged = filtered.slice((curPage - 1) * perPage, curPage * perPage);

  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(allOn ? new Set() : new Set(filtered.map((l) => l.id)));

  async function bulkStatus(s: LeadStatus) {
    const ids = [...selected];
    if (!ids.length) return;
    await updateLeadStatus(ids, s, account?.id);
    setSelected(new Set());
    refetch();
  }

  if (loading) return <div style={{ display: "grid", placeItems: "center", minHeight: 300 }}><Icon name="loader" size={26} className="ml-spin" style={{ color: "var(--ml-primary)" }} /></div>;
  if (error) return <div style={{ color: "var(--ml-red)", fontSize: 14 }}>{error}</div>;

  const kNew = leads.filter((l) => l.status === "new").length;
  const kQual = leads.filter((l) => l.status === "qualified").length;
  const kConv = leads.filter((l) => l.status === "converted").length;

  return (
    <div className="ml-fade">
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 16 }}>
        <KpiCard label={X.total} value={leads.length} color="var(--ml-text)" />
        <KpiCard label={L.new} value={kNew} color="var(--ml-primary)" />
        <KpiCard label={L.qualified} value={kQual} color="var(--ml-amber)" />
        <KpiCard label={L.converted} value={kConv} color="var(--ml-green)" />
      </div>

      {/* toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <span style={{ position: "absolute", left: 12, top: 11, color: "var(--ml-muted)" }}><Icon name="search" size={16} /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.searchPh}
            style={{ width: "100%", padding: "10px 12px 10px 38px", borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", fontSize: 14, outline: "none" }} />
        </div>
        <button onClick={() => setFiltersOpen((v) => !v)} style={{ ...btn, borderColor: activeFilters ? "var(--ml-primary)" : "var(--ml-border)", color: activeFilters ? "var(--ml-primary)" : "var(--ml-text)", background: activeFilters ? "rgba(109,92,245,.1)" : "var(--ml-card)" }}>
          <Icon name="settings" size={15} /> {L.filters}{activeFilters ? ` (${activeFilters})` : ""}
        </button>
        <button onClick={() => setImportOpen(true)} style={btn}><Icon name="plus" size={15} /> {X.import}</button>
        <button onClick={() => exportLeads(filtered, getExportFormat())} style={{ ...btn, border: "none", background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", color: "#fff" }}><Icon name="chart" size={15} /> {L.exportCsv}</button>
      </div>

      {filtersOpen && (
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <Select value={fStatus} onChange={(v) => setFStatus(v as LeadStatus | "all")} label={L.status} options={[["all", L.all], ["new", L.new], ["qualified", L.qualified], ["converted", L.converted]]} />
          <Select value={fIndustry} onChange={setFIndustry} label={L.industry} options={[["all", L.all], ...industries.map((i) => [i, i] as [string, string])]} />
          <Select value={fTemp} onChange={(v) => setFTemp(v as Temperature | "all")} label={L.temperature} options={[["all", L.all], ["hot", L.hot], ["warm", L.warm], ["cool", L.cool]]} />
          {activeFilters > 0 && <button onClick={() => { setFStatus("all"); setFIndustry("all"); setFTemp("all"); }} style={{ ...btn, color: "var(--ml-muted)" }}>{L.clearFilters}</button>}
        </div>
      )}

      {/* bulk bar */}
      {selCount > 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, padding: "10px 14px", borderRadius: 12, background: "rgba(109,92,245,.08)", border: "1px solid rgba(109,92,245,.25)", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ml-primary)" }}>{selCount} {selCount === 1 ? L.selectedOne : L.selected}</span>
          <span style={{ fontSize: 13, color: "var(--ml-muted)" }}>·</span>
          {(["new", "qualified", "converted"] as LeadStatus[]).map((s) => (
            <button key={s} onClick={() => bulkStatus(s)} style={{ ...chipBtn, color: STATUS_META[s].color, background: STATUS_META[s].bg }}>{L[s]}</button>
          ))}
          <button onClick={() => setEmailOpen(true)} style={{ ...chipBtn, color: "#fff", background: "var(--ml-primary)" }}><Icon name="mail" size={14} /> {X.massEmail}</button>
          <button onClick={() => exportLeads(leads.filter((l) => selected.has(l.id)), getExportFormat())} style={{ ...chipBtn, color: "var(--ml-text)", background: "var(--ml-grid)" }}><Icon name="chart" size={14} /> {L.exportCsv}</button>
          <button onClick={() => setSelected(new Set())} style={{ ...chipBtn, color: "var(--ml-muted)", background: "transparent", marginLeft: "auto" }}>{L.clearSel}</button>
        </div>
      ) : null}

      {/* table */}
      <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 16, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: "var(--ml-grid)", color: "var(--ml-muted)", textAlign: "left" }}>
              <th style={{ ...th, width: 44 }}><Check on={allOn} onClick={toggleAll} /></th>
              <th style={th}>{L.company}</th>
              <th style={{ ...th, width: 120 }}>{L.status}</th>
              <th style={thHideSm}>{L.industry}</th>
              <th style={thHideSm}>{X.loc}</th>
              <th style={thHideSm}>{L.phone}</th>
              <th style={th}>{X.tags}</th>
              <th style={{ ...th, width: 44 }} />
            </tr>
          </thead>
          <tbody>
            {paged.map((l) => {
              const on = selected.has(l.id);
              const sm = STATUS_META[l.status];
              const tm = TEMP_META[l.temp];
              const tags = l.tags.length ? l.tags : [L[l.temp]];
              return (
                <tr key={l.id} onClick={() => setOpenLead(l)} style={{ borderTop: "1px solid var(--ml-border)", cursor: "pointer", background: on ? "rgba(109,92,245,.05)" : "transparent" }}
                  onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--ml-hover)"; }}
                  onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                  <td style={td} onClick={(e) => { e.stopPropagation(); toggle(l.id); }}><Check on={on} onClick={() => {}} /></td>
                  <td style={td}>
                    <div style={{ fontWeight: 600, color: "var(--ml-text)" }}>{l.company}</div>
                    <div style={{ fontSize: 12, color: "var(--ml-muted)" }}>{l.industry || "—"}</div>
                  </td>
                  <td style={td}><span style={{ fontSize: 12, fontWeight: 700, color: sm.color, background: sm.bg, padding: "4px 11px", borderRadius: 20 }}>{L[l.status]}</span></td>
                  <td style={{ ...td, color: "var(--ml-muted)" }} className="ml-hide-sm">{l.industry || "—"}</td>
                  <td style={{ ...td, color: "var(--ml-muted)" }} className="ml-hide-sm">{l.location || "—"}</td>
                  <td style={{ ...td, color: hasVal(l.phone) ? "var(--ml-text)" : "var(--ml-muted)" }} className="ml-hide-sm">{l.phone || "—"}</td>
                  <td style={td}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {tags.slice(0, 2).map((tg, i) => (
                        <span key={i} style={{ fontSize: 11.5, fontWeight: 700, color: tm.color, background: tm.bg, padding: "3px 10px", borderRadius: 20 }}>{tg}</span>
                      ))}
                    </div>
                  </td>
                  <td style={td} onClick={(e) => { e.stopPropagation(); setOpenLead(l); }}>
                    <span style={{ display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: 8, color: "var(--ml-muted)" }}>⋯</span>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ ...td, textAlign: "center", color: "var(--ml-muted)", padding: 40 }}>{L.noLeads}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "var(--ml-muted)" }}>{L.showing} {paged.length} / {filtered.length}</span>
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button onClick={() => setPage(Math.max(1, curPage - 1))} disabled={curPage <= 1} style={pagerBtn(curPage <= 1)}>{X.prev}</button>
            {pageWindow(curPage, totalPages).map((n, i) => n === -1
              ? <span key={`e${i}`} style={{ color: "var(--ml-muted)", padding: "0 4px" }}>…</span>
              : <button key={n} onClick={() => setPage(n)} style={numBtn(n === curPage)}>{n}</button>)}
            <button onClick={() => setPage(Math.min(totalPages, curPage + 1))} disabled={curPage >= totalPages} style={pagerBtn(curPage >= totalPages)}>{X.next}</button>
          </div>
        )}
      </div>

      <LeadDrawer lead={openLead} onClose={() => setOpenLead(null)} onChanged={refetch} />
      {emailOpen && <MassEmailModal leadIds={[...selected]} onClose={() => setEmailOpen(false)} />}
      {importOpen && <ImportCsvModal accountId={account?.id} userId={session?.user?.id} existing={leads.map((l) => ({ phone: l.phone, website: l.website }))} onDone={refetch} onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function Check({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <span onClick={onClick} style={{ width: 18, height: 18, borderRadius: 5, display: "inline-grid", placeItems: "center", cursor: "pointer", border: `1px solid ${on ? "var(--ml-primary)" : "var(--ml-border)"}`, background: on ? "var(--ml-primary)" : "var(--ml-card)", color: "#fff" }}>
      {on && <Icon name="check" size={12} />}
    </span>
  );
}

function Select({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
      <span style={{ color: "var(--ml-muted)", fontWeight: 600 }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", fontSize: 13, outline: "none", minWidth: 140 }}>
        {options.map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
      </select>
    </label>
  );
}

function KpiCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 16, padding: "16px 18px", boxShadow: "0 4px 16px rgba(30,25,70,.04)" }}>
      <div style={{ fontSize: 12.5, color: "var(--ml-muted)", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, color, marginTop: 4 }}>{value}</div>
    </div>
  );
}

function pageWindow(cur: number, total: number): number[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: number[] = [1];
  const start = Math.max(2, cur - 1), end = Math.min(total - 1, cur + 1);
  if (start > 2) out.push(-1);
  for (let i = start; i <= end; i++) out.push(i);
  if (end < total - 1) out.push(-1);
  out.push(total);
  return out;
}

const pagerBtn = (disabled: boolean): CSSProperties => ({ padding: "8px 14px", borderRadius: 9, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1 });
const numBtn = (active: boolean): CSSProperties => ({ minWidth: 34, height: 34, borderRadius: 9, border: active ? "none" : "1px solid var(--ml-border)", background: active ? "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))" : "var(--ml-card)", color: active ? "#fff" : "var(--ml-text)", fontSize: 13, fontWeight: 700, cursor: "pointer" });

const btn: CSSProperties = { display: "flex", alignItems: "center", gap: 7, padding: "10px 14px", borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" };
const chipBtn: CSSProperties = { display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 9, border: "none", fontSize: 12.5, fontWeight: 700, cursor: "pointer" };
const th: CSSProperties = { padding: "12px 14px", fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 };
const thHideSm: CSSProperties = { ...th };
const td: CSSProperties = { padding: "12px 14px", verticalAlign: "middle" };
