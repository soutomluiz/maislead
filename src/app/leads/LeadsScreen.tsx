import { useEffect, useMemo, useState, CSSProperties } from "react";
import { useLang } from "../LangTheme";
import { useAuth } from "../AuthContext";
import { Icon } from "../icons";
import { getPerPage, getExportFormat, type ExportFormat } from "../prefs";
import { leadsI18n } from "./i18n";
import { useLeads, updateLeadStatus } from "./useLeads";
import { LeadRow, LeadStatus, STATUS_META, hasVal, reputationRisk } from "./model";
import { LeadDrawer } from "./LeadDrawer";
import { MassEmailModal } from "./MassEmailModal";
import { ImportCsvModal } from "./ImportCsvModal";
import { EnrichEmailsModal } from "./EnrichEmailsModal";
import { DetectTechModal } from "./DetectTechModal";
import { AddTagModal } from "./AddTagModal";
import { usePlan, upsellText, minPlanLabel, type Feature } from "../plan";
import type { Temperature } from "@/lib/score";

const XT = {
  pt: { import: "Importar", massEmail: "Enviar E-mail", findEmail: "Buscar E-mails", detectTech: "Detectar Tecnologia", addTag: "Adicionar Tag", total: "Total de Leads", tags: "Tags", loc: "Localização", email: "E-mail", newBadge: "novo", prev: "Anterior", next: "Próximo", contact: "Contato", cAny: "Qualquer contato", cHasEmail: "Com e-mail", cNoEmail: "Sem e-mail", cHasPhone: "Com telefone", cNoPhone: "Sem telefone", rep: "Reputação", repAll: "Todas", repRisk: "Em risco" },
  en: { import: "Import", massEmail: "Send Email", findEmail: "Find Emails", detectTech: "Detect Tech", addTag: "Add Tag", total: "Total Leads", tags: "Tags", loc: "Location", email: "Email", newBadge: "new", prev: "Previous", next: "Next", contact: "Contact", cAny: "Any contact", cHasEmail: "Has email", cNoEmail: "No email", cHasPhone: "Has phone", cNoPhone: "No phone", rep: "Reputation", repAll: "All", repRisk: "At risk" },
  es: { import: "Importar", massEmail: "Enviar Email", findEmail: "Buscar Emails", detectTech: "Detectar Tecnología", addTag: "Añadir Tag", total: "Total de Leads", tags: "Tags", loc: "Ubicación", email: "Email", newBadge: "nuevo", prev: "Anterior", next: "Siguiente", contact: "Contacto", cAny: "Cualquier contacto", cHasEmail: "Con email", cNoEmail: "Sin email", cHasPhone: "Con teléfono", cNoPhone: "Sin teléfono", rep: "Reputación", repAll: "Todas", repRisk: "En riesgo" },
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
  const { leads, enrichedIds, loading, error, refetch } = useLeads();
  const [emailOpen, setEmailOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [enrichOpen, setEnrichOpen] = useState(false);
  const [enrichIds, setEnrichIds] = useState<string[]>([]);
  const [techOpen, setTechOpen] = useState(false);
  const [techIds, setTechIds] = useState<string[]>([]);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const { can } = usePlan();
  const [gated, setGated] = useState<Feature | null>(null);
  const gate = (f: Feature, action: () => void) => () => (can(f) ? action() : setGated(f));

  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState<LeadStatus | "all">("all");
  const [fIndustry, setFIndustry] = useState<string>("all");
  const [fTemp, setFTemp] = useState<Temperature | "all">("all");
  type ContactFilter = "all" | "hasEmail" | "noEmail" | "hasPhone" | "noPhone";
  const [fContact, setFContact] = useState<ContactFilter>("all");
  const [fRep, setFRep] = useState<"all" | "risk">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openLead, setOpenLead] = useState<LeadRow | null>(null);
  const perPage = getPerPage();
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [q, fStatus, fIndustry, fTemp, fContact, fRep]);

  const industries = useMemo(() => Array.from(new Set(leads.map((l) => l.industry).filter(Boolean))) as string[], [leads]);
  // leads que dá pra enriquecer: têm site mas ainda sem e-mail
  const enrichable = useMemo(() => leads.filter((l) => hasVal(l.website) && !hasVal(l.email)).map((l) => l.id), [leads]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (fStatus !== "all" && l.status !== fStatus) return false;
      if (fIndustry !== "all" && l.industry !== fIndustry) return false;
      if (fTemp !== "all" && l.temp !== fTemp) return false;
      if (fContact !== "all") {
        const hasEmail = hasVal(l.email), hasPhone = hasVal(l.phone);
        if (fContact === "hasEmail" && !hasEmail) return false;
        if (fContact === "noEmail" && hasEmail) return false;
        if (fContact === "hasPhone" && !hasPhone) return false;
        if (fContact === "noPhone" && hasPhone) return false;
      }
      if (fRep === "risk" && !reputationRisk(l)) return false;
      if (term) {
        const hay = `${l.company} ${l.contact ?? ""} ${l.phone ?? ""} ${l.email ?? ""} ${l.location ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [leads, q, fStatus, fIndustry, fTemp, fContact, fRep]);

  const activeFilters = (fStatus !== "all" ? 1 : 0) + (fIndustry !== "all" ? 1 : 0) + (fTemp !== "all" ? 1 : 0) + (fContact !== "all" ? 1 : 0) + (fRep !== "all" ? 1 : 0);
  const allOn = filtered.length > 0 && filtered.every((l) => selected.has(l.id));
  const selCount = selected.size;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const curPage = Math.min(page, totalPages);
  const paged = filtered.slice((curPage - 1) * perPage, curPage * perPage);

  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
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
      {/* 4 mini-KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14, marginBottom: 18 }}>
        <MiniKpi label={X.total} value={leads.length} color="var(--ml-text)" />
        <MiniKpi label={L.new} value={kNew} color="#4c2ee0" />
        <MiniKpi label={L.qualified} value={kQual} color="#f59e0b" />
        <MiniKpi label={L.converted} value={kConv} color="#10b981" />
      </div>

      {/* Card único: toolbar + filtros + bulk + tabela + paginação */}
      <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 20, boxShadow: "0 1px 3px rgba(30,25,60,.04)", overflow: "hidden" }}>
        {/* Toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 20px", borderBottom: "1px solid var(--ml-border)", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--ml-muted)", display: "flex" }}><Icon name="search" size={16} /></span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.searchPh} className="ml-input"
              style={{ width: "100%", height: 42, borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", padding: "0 14px 0 38px", fontSize: 14, outline: "none" }} />
          </div>
          <OutlineBtn onClick={() => setFiltersOpen((v) => !v)} icon="filter" active={activeFilters > 0}>
            {L.filters}{activeFilters ? ` (${activeFilters})` : ""}
          </OutlineBtn>
          {enrichable.length > 0 && (
            <OutlineBtn onClick={() => { setEnrichIds(enrichable); setEnrichOpen(true); }} icon="mail">{X.findEmail} ({enrichable.length})</OutlineBtn>
          )}
          <OutlineBtn onClick={() => setImportOpen(true)} icon="upload">{X.import}</OutlineBtn>
          <button onClick={() => exportLeads(filtered, getExportFormat())} style={primaryBtn}>
            <Icon name="download" size={15} /> {L.exportCsv}
          </button>
        </div>

        {/* Filtros */}
        {filtersOpen && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, padding: "16px 20px", borderBottom: "1px solid var(--ml-border)", background: "var(--ml-hover)", flexWrap: "wrap" }}>
            <Select value={fStatus} onChange={(v) => setFStatus(v as LeadStatus | "all")} label={L.status} options={[["all", L.all], ["new", L.new], ["qualified", L.qualified], ["converted", L.converted]]} />
            <Select value={fIndustry} onChange={setFIndustry} label={L.industry} options={[["all", L.all], ...industries.map((i) => [i, i] as [string, string])]} />
            <Select value={fTemp} onChange={(v) => setFTemp(v as Temperature | "all")} label={L.temperature} options={[["all", L.all], ["hot", L.hot], ["warm", L.warm], ["cool", L.cool]]} />
            <Select value={fContact} onChange={(v) => setFContact(v as ContactFilter)} label={X.contact} options={[["all", X.cAny], ["hasEmail", X.cHasEmail], ["noEmail", X.cNoEmail], ["hasPhone", X.cHasPhone], ["noPhone", X.cNoPhone]]} />
            <Select value={fRep} onChange={(v) => setFRep(v as "all" | "risk")} label={X.rep} options={[["all", X.repAll], ["risk", X.repRisk]]} />
            <button onClick={() => { setFStatus("all"); setFIndustry("all"); setFTemp("all"); setFContact("all"); setFRep("all"); }} style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{L.clearFilters}</button>
          </div>
        )}

        {/* Barra de seleção */}
        {selCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 20px", borderBottom: "1px solid var(--ml-border)", background: "rgba(76,46,224,.07)", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "#4c2ee0" }}>{selCount} {selCount === 1 ? L.selectedOne : L.selected}</span>
            <span style={{ flex: 1 }} />
            <button onClick={gate("enrich", () => { setEnrichIds([...selected]); setEnrichOpen(true); })} style={{ ...bulkOutline, fontWeight: 700 }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#4c2ee0"; e.currentTarget.style.color = "#4c2ee0"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--ml-border)"; e.currentTarget.style.color = "var(--ml-text)"; }}><Icon name="search" size={15} /> {X.findEmail}{!can("enrich") && <Icon name="lock" size={12} />}</button>
            <button onClick={gate("detectTech", () => { setTechIds([...selected]); setTechOpen(true); })} style={{ ...bulkOutline, fontWeight: 700 }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#4c2ee0"; e.currentTarget.style.color = "#4c2ee0"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--ml-border)"; e.currentTarget.style.color = "var(--ml-text)"; }}><Icon name="cpu" size={15} /> {X.detectTech}{!can("detectTech") && <Icon name="lock" size={12} />}</button>
            {/* E-mail em massa desativado até a v3 (ver TODO.md). UI escondida; modal/edge function preservados. */}
            {/* <button onClick={gate("massEmail", () => setEmailOpen(true))} style={bulkOutline}><Icon name="mail" size={15} /> {X.massEmail}{!can("massEmail") && <Icon name="lock" size={12} />}</button> */}
            <button onClick={() => { setTagIds([...selected]); setTagOpen(true); }} style={bulkOutline}><Icon name="tag" size={14} /> {X.addTag}</button>
            <button onClick={() => exportLeads(leads.filter((l) => selected.has(l.id)), getExportFormat())} style={bulkOutline}><Icon name="download" size={14} /> {L.exportCsv}</button>
            {(["new", "qualified", "converted"] as LeadStatus[]).map((s) => (
              <button key={s} onClick={() => bulkStatus(s)} style={{ ...bulkOutline, color: STATUS_META[s].color, borderColor: "var(--ml-border)" }}>{L[s]}</button>
            ))}
            <button onClick={() => setSelected(new Set())} title={L.clearSel} style={{ height: 38, width: 38, border: "1px solid var(--ml-border)", borderRadius: 10, background: "var(--ml-card)", color: "var(--ml-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="x" size={15} strokeWidth={2.2} /></button>
          </div>
        )}

        {gated && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 20px", borderBottom: "1px solid var(--ml-border)", background: "rgba(76,46,224,.06)" }}>
            <Icon name={minPlanLabel(gated) === "Business" ? "crown" : "lock"} size={15} style={{ color: "var(--ml-primary)", flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "var(--ml-text)", flex: 1 }}>{upsellText(gated, lang)}</span>
            <button onClick={() => setGated(null)} style={{ border: "none", background: "transparent", color: "var(--ml-muted)", cursor: "pointer", display: "flex" }}><Icon name="x" size={15} strokeWidth={2.2} /></button>
          </div>
        )}

        {/* Tabela */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ ...thBase, padding: "14px 12px 14px 20px", width: 20 }}><Check on={allOn} onClick={toggleAll} /></th>
                <th style={thBase}>{L.company}</th>
                <th style={thBase}>{L.status}</th>
                <th style={thBase}>{L.industry}</th>
                <th style={thBase}>{X.loc}</th>
                <th style={thBase}>{L.phone}</th>
                <th style={thBase}>{X.email}</th>
                <th style={thBase}>{X.tags}</th>
                <th style={{ ...thBase, padding: "14px 20px" }} />
              </tr>
            </thead>
            <tbody>
              {paged.map((l) => {
                const on = selected.has(l.id);
                const sm = STATUS_META[l.status];
                const tags = l.tags.length ? l.tags : [L[l.temp]];
                return (
                  <tr key={l.id} onClick={() => setOpenLead(l)} style={{ borderTop: "1px solid var(--ml-border)", cursor: "pointer", background: on ? "rgba(76,46,224,.05)" : "transparent", transition: "background .1s" }}
                    onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--ml-hover)"; }}
                    onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}>
                    <td style={{ ...tdBase, padding: "15px 12px 15px 20px" }} onClick={(e) => { e.stopPropagation(); toggle(l.id); }}><Check on={on} onClick={() => {}} /></td>
                    <td style={tdBase}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{l.company}</div>
                      <div style={{ fontSize: 12, color: "var(--ml-muted)", marginTop: 2 }}>{l.industry || "—"}</div>
                    </td>
                    <td style={tdBase}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "5px 11px", borderRadius: 20, color: sm.color, background: sm.bg }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />{L[l.status]}
                      </span>
                    </td>
                    <td style={{ ...tdBase, fontSize: 13.5, color: "var(--ml-muted)" }}>{l.industry || "—"}</td>
                    <td style={{ ...tdBase, fontSize: 13.5, color: "var(--ml-muted)" }}>{l.location || "—"}</td>
                    <td style={{ ...tdBase, fontSize: 13.5, fontWeight: 500, color: hasVal(l.phone) ? "var(--ml-text)" : "var(--ml-muted)" }}>{l.phone || "—"}</td>
                    <td style={tdBase}><EmailCell email={l.email} isNew={enrichedIds.has(l.id)} badge={X.newBadge} /></td>
                    <td style={tdBase}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {tags.slice(0, 2).map((tg, i) => (
                          <span key={i} style={{ fontSize: 11.5, fontWeight: 600, color: "#4c2ee0", background: "rgba(76,46,224,.1)", padding: "4px 10px", borderRadius: 20 }}>{tg}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ ...tdBase, padding: "15px 20px", textAlign: "right" }} onClick={(e) => { e.stopPropagation(); setOpenLead(l); }}>
                      <button style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-muted)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#4c2ee0"; e.currentTarget.style.borderColor = "#4c2ee0"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ml-muted)"; e.currentTarget.style.borderColor = "var(--ml-border)"; }}>
                        <Icon name="dots" size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ ...tdBase, textAlign: "center", color: "var(--ml-muted)", padding: 40 }}>{L.noLeads}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderTop: "1px solid var(--ml-border)", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--ml-muted)" }}>{L.showing} {paged.length} / {filtered.length}</span>
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button onClick={() => setPage(Math.max(1, curPage - 1))} disabled={curPage <= 1} style={pagerBtn(curPage <= 1)}>{X.prev}</button>
              {pageWindow(curPage, totalPages).map((n, i) => n === -1
                ? <span key={`e${i}`} style={{ color: "var(--ml-muted)", padding: "0 4px" }}>…</span>
                : <button key={n} onClick={() => setPage(n)} style={numBtn(n === curPage)}>{n}</button>)}
              <button onClick={() => setPage(Math.min(totalPages, curPage + 1))} disabled={curPage >= totalPages} style={pagerBtn(curPage >= totalPages)}>{X.next}</button>
            </div>
          )}
        </div>
      </div>

      <LeadDrawer lead={openLead} onClose={() => setOpenLead(null)} onChanged={refetch} />
      {/* E-mail em massa desativado até a v3 — modal preservado, só não montado. */}
      {/* {emailOpen && <MassEmailModal leadIds={[...selected]} onClose={() => setEmailOpen(false)} />} */}
      {enrichOpen && <EnrichEmailsModal leadIds={enrichIds} onDone={refetch} onClose={() => setEnrichOpen(false)} />}
      {techOpen && <DetectTechModal leadIds={techIds} onDone={refetch} onClose={() => setTechOpen(false)} />}
      {importOpen && <ImportCsvModal accountId={account?.id} userId={session?.user?.id} existing={leads.map((l) => ({ phone: l.phone, website: l.website }))} onDone={refetch} onClose={() => setImportOpen(false)} />}
      {tagOpen && <AddTagModal leadIds={tagIds} onDone={() => { setSelected(new Set()); refetch(); }} onClose={() => setTagOpen(false)} />}
    </div>
  );
}

function OutlineBtn({ children, icon, onClick, active }: { children: React.ReactNode; icon: Parameters<typeof Icon>[0]["name"]; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick}
      style={{ height: 42, padding: "0 16px", borderRadius: 11, border: "1px solid var(--ml-border)", background: active ? "rgba(76,46,224,.1)" : "var(--ml-card)", color: active ? "#4c2ee0" : "var(--ml-text)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#4c2ee0"; e.currentTarget.style.color = "#4c2ee0"; }}
      onMouseLeave={(e) => { if (!active) { e.currentTarget.style.borderColor = "var(--ml-border)"; e.currentTarget.style.color = "var(--ml-text)"; } }}>
      <Icon name={icon} size={15} /> {children}
    </button>
  );
}

function EmailCell({ email, isNew, badge }: { email: string | null; isNew: boolean; badge: string }) {
  if (!hasVal(email)) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#c3c0d6", fontSize: 13 }}>
        <Icon name="x" size={12} strokeWidth={2} />—
      </span>
    );
  }
  if (isNew) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, maxWidth: 240 }}>
        <span style={{ color: "#059669", fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
        <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.4, color: "#059669", background: "rgba(16,185,129,.13)", padding: "2px 6px", borderRadius: 6 }}>{badge}</span>
      </span>
    );
  }
  return <span style={{ display: "inline-block", maxWidth: 240, color: "var(--ml-text)", fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "middle" }}>{email}</span>;
}

function Check({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <span onClick={onClick} style={{ width: 20, height: 20, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: `1px solid ${on ? "#4c2ee0" : "var(--ml-border)"}`, background: on ? "#4c2ee0" : "var(--ml-card)", color: "#fff" }}>
      {on && <Icon name="check" size={12} strokeWidth={2.6} />}
    </span>
  );
}

function Select({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: [string, string][] }) {
  return (
    <div style={{ flex: 1, minWidth: 150 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: "var(--ml-muted)", display: "block", marginBottom: 6 }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", padding: "0 12px", fontSize: 13.5, outline: "none", cursor: "pointer" }}>
        {options.map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
      </select>
    </div>
  );
}

function MiniKpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 16, padding: "16px 18px" }}>
      <div style={{ fontSize: 12, color: "var(--ml-muted)" }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, marginTop: 2, color }}>{value}</div>
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

const primaryBtn: CSSProperties = { height: 42, padding: "0 16px", border: "none", borderRadius: 11, background: "linear-gradient(135deg,#4c2ee0,#6d4bff)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 6px 14px rgba(76,46,224,.25)" };
const bulkPrimary: CSSProperties = { height: 38, padding: "0 15px", border: "none", borderRadius: 10, background: "linear-gradient(135deg,#4c2ee0,#6d4bff)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, boxShadow: "0 5px 12px rgba(76,46,224,.25)" };
const bulkOutline: CSSProperties = { height: 38, padding: "0 15px", border: "1px solid var(--ml-border)", borderRadius: 10, background: "var(--ml-card)", color: "var(--ml-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 };
const pagerBtn = (disabled: boolean): CSSProperties => ({ height: 34, padding: "0 12px", borderRadius: 9, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: disabled ? "var(--ml-muted)" : "var(--ml-text)", fontSize: 13, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 });
const numBtn = (active: boolean): CSSProperties => ({ minWidth: 34, height: 34, borderRadius: 9, border: active ? "none" : "1px solid var(--ml-border)", background: active ? "#4c2ee0" : "var(--ml-card)", color: active ? "#fff" : "var(--ml-text)", fontSize: 13, fontWeight: 700, cursor: "pointer" });
const thBase: CSSProperties = { padding: "14px 12px", fontSize: 11.5, fontWeight: 700, color: "var(--ml-muted)", textTransform: "uppercase", letterSpacing: 0.4 };
const tdBase: CSSProperties = { padding: "15px 12px", verticalAlign: "middle" };
