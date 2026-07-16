import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "../LangTheme";
import { useAuth } from "../AuthContext";
import { Icon } from "../icons";
import type { ScreenKey } from "@/i18n/ml";
import { StagingDetailModal, type StagingCompany, type Badge as BadgeT } from "./StagingDetailModal";

const Panel = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 20, padding: 20, boxShadow: "0 1px 3px rgba(30,25,60,.04)", ...style }}>{children}</div>
);

const DICT = {
  pt: {
    title: "Buscar por CNPJ", sub: "Consulte empresas na base oficial da Receita",
    label: "CNPJs", ph: "Cole um ou mais CNPJs, um por linha.\nEx: 33.000.167/0001-01\n47.960.950/0001-21",
    detected: "válidos detectados", invalidCount: "inválidos", search: "Buscar empresas", searching: "Consultando…",
    info: "Traz razão social, nome fantasia, telefone, e-mail, endereço, CNAE (atividade), porte e situação cadastral — direto da Receita.",
    examples: "Exemplos para testar", clear: "Limpar",
    reqCnpj: "Cole ao menos um CNPJ válido para buscar.", errGeneric: "Não foi possível concluir a consulta agora.",
    done: "Consulta concluída", newLeads: "novos", dups: "duplicados", notFound: "não encontrados",
    quotaLabel: "Plano", quotaMonth: "leads extraídos este mês", quotaOf: "de", unlimited: "ilimitado", willUse: "vão usar", ofQuota: "da sua cota",
    selNew: "Selecionar novos", goLeads: "Ver na lista de Leads", addN: "Adicionar à lista",
    limitHit: "Você atingiu o limite do plano", limitExceed: "Essa seleção passa do seu limite (cabem mais", upgrade: "Fazer upgrade",
    detail: "Ver detalhe", badgeNew: "novo", badgeExists: "já existe",
    dReceita: "Dados da Receita", dRazao: "Razão social", dFantasia: "Nome fantasia", dPorte: "Porte", dCnae: "Atividade (CNAE)", dAbertura: "Abertura", dCapital: "Capital social",
    dPhone: "Telefone", dEmail: "E-mail", dAddress: "Endereço", added: "Já na lista", adding: "Adicionando…", noEmpty: "Nenhuma empresa encontrada para esses CNPJs.",
    sit: { ativa: "Ativa", baixada: "Baixada", inapta: "Inapta", suspensa: "Suspensa", nula: "Nula", other: "—" } as Record<string, string>,
  },
  en: {
    title: "CNPJ Lookup", sub: "Query companies in Brazil's official registry",
    label: "CNPJs", ph: "Paste one or more CNPJs, one per line.\nEx: 33.000.167/0001-01\n47.960.950/0001-21",
    detected: "valid detected", invalidCount: "invalid", search: "Search companies", searching: "Querying…",
    info: "Returns legal name, trade name, phone, email, address, activity (CNAE), size and registration status — straight from the registry.",
    examples: "Examples to test", clear: "Clear",
    reqCnpj: "Paste at least one valid CNPJ to search.", errGeneric: "Couldn't complete the lookup right now.",
    done: "Lookup complete", newLeads: "new", dups: "duplicates", notFound: "not found",
    quotaLabel: "Plan", quotaMonth: "leads extracted this month", quotaOf: "of", unlimited: "unlimited", willUse: "will use", ofQuota: "of your quota",
    selNew: "Select new", goLeads: "View in Leads list", addN: "Add to list",
    limitHit: "You reached the limit of the plan", limitExceed: "This selection exceeds your limit (only", upgrade: "Upgrade",
    detail: "View detail", badgeNew: "new", badgeExists: "exists",
    dReceita: "Registry data", dRazao: "Legal name", dFantasia: "Trade name", dPorte: "Size", dCnae: "Activity (CNAE)", dAbertura: "Opened", dCapital: "Share capital",
    dPhone: "Phone", dEmail: "Email", dAddress: "Address", added: "In list", adding: "Adding…", noEmpty: "No company found for those CNPJs.",
    sit: { ativa: "Active", baixada: "Closed", inapta: "Unfit", suspensa: "Suspended", nula: "Void", other: "—" } as Record<string, string>,
  },
  es: {
    title: "Búsqueda por CNPJ", sub: "Consulta empresas en el registro oficial de Brasil",
    label: "CNPJs", ph: "Pega uno o más CNPJs, uno por línea.\nEj: 33.000.167/0001-01\n47.960.950/0001-21",
    detected: "válidos detectados", invalidCount: "inválidos", search: "Buscar empresas", searching: "Consultando…",
    info: "Devuelve razón social, nombre comercial, teléfono, email, dirección, actividad (CNAE), tamaño y situación — directo del registro.",
    examples: "Ejemplos para probar", clear: "Limpiar",
    reqCnpj: "Pega al menos un CNPJ válido para buscar.", errGeneric: "No se pudo completar la consulta ahora.",
    done: "Consulta completa", newLeads: "nuevos", dups: "duplicados", notFound: "no encontrados",
    quotaLabel: "Plan", quotaMonth: "leads extraídos este mes", quotaOf: "de", unlimited: "ilimitado", willUse: "usarán", ofQuota: "de tu cuota",
    selNew: "Seleccionar nuevos", goLeads: "Ver en la lista de Leads", addN: "Añadir a la lista",
    limitHit: "Alcanzaste el límite del plan", limitExceed: "Esta selección supera tu límite (caben", upgrade: "Mejorar plan",
    detail: "Ver detalle", badgeNew: "nuevo", badgeExists: "ya existe",
    dReceita: "Datos del registro", dRazao: "Razón social", dFantasia: "Nombre comercial", dPorte: "Tamaño", dCnae: "Actividad (CNAE)", dAbertura: "Apertura", dCapital: "Capital social",
    dPhone: "Teléfono", dEmail: "Email", dAddress: "Dirección", added: "En la lista", adding: "Añadiendo…", noEmpty: "No se encontró empresa para esos CNPJs.",
    sit: { ativa: "Activa", baixada: "Baja", inapta: "Inapta", suspensa: "Suspendida", nula: "Nula", other: "—" } as Record<string, string>,
  },
};

const EXAMPLES: { name: string; cnpj: string }[] = [
  { name: "Petrobras", cnpj: "33.000.167/0001-01" },
  { name: "Magazine Luiza", cnpj: "47.960.950/0001-21" },
  { name: "Natura", cnpj: "71.673.990/0001-77" },
  { name: "Localiza", cnpj: "16.670.085/0001-55" },
];

const SIT_META: Record<string, { color: string; bg: string }> = {
  ativa: { color: "#059669", bg: "rgba(16,185,129,.13)" },
  baixada: { color: "#dc2626", bg: "rgba(239,68,68,.11)" },
  nula: { color: "#dc2626", bg: "rgba(239,68,68,.11)" },
  inapta: { color: "#c07f0d", bg: "rgba(245,158,11,.13)" },
  suspensa: { color: "#c07f0d", bg: "rgba(245,158,11,.13)" },
  other: { color: "var(--ml-muted)", bg: "var(--ml-grid)" },
};

function onlyDigits(s: string) { return s.replace(/\D/g, ""); }
function isValidCnpj(c: string): boolean {
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: string) => {
    let sum = 0, pos = base.length - 7;
    for (let i = 0; i < base.length; i++) { sum += parseInt(base[i], 10) * pos--; if (pos < 2) pos = 9; }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(c.slice(0, 12));
  const d2 = calc(c.slice(0, 12) + d1);
  return c.slice(12) === `${d1}${d2}`;
}
function parseCnpjs(raw: string): { valid: string[]; invalid: number } {
  const tokens = raw.split(/[\s,;]+/).map(onlyDigits).filter(Boolean);
  const valid = new Set<string>();
  let invalid = 0;
  for (const t of tokens) { if (t.length === 14 && isValidCnpj(t)) valid.add(t); else invalid++; }
  return { valid: [...valid], invalid };
}

type Row = {
  cnpj: string; cnpjFmt: string; company: string; razao_social: string; nome_fantasia: string;
  phone: string | null; email: string | null; address: string | null; location: string | null;
  cnae: string | null; porte: string | null; abertura: string | null; capital: string | null;
  situacao: string; situacaoKey: string; score: number; duplicate: boolean;
};
type Quota = { used: number; limit: number | null; plan: string; isAdmin: boolean };
type LookupData = { results: Row[]; notFound: number; invalid: number; quota: Quota };

export function CnpjScreen({ onNavigate }: { onNavigate?: (s: ScreenKey) => void }) {
  const { lang } = useLang();
  const { refresh } = useAuth();
  const D = DICT[lang];
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<LookupData | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [drawer, setDrawer] = useState<Row | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const parsed = useMemo(() => parseCnpjs(text), [text]);
  useEffect(() => { setErr(null); }, [text]);

  const isDupe = (r: Row) => r.duplicate || added.has(r.cnpj);

  async function runLookup() {
    setErr(null); setData(null); setSelected(new Set());
    if (!parsed.valid.length) { setErr(D.reqCnpj); return; }
    setBusy(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("extract-cnpj", { body: { cnpjs: parsed.valid, mode: "lookup" } });
      if (error || res?.error) { setErr(D.errGeneric); return; }
      setData({ results: res.results ?? [], notFound: res.notFound ?? 0, invalid: res.invalid ?? 0, quota: res.quota });
    } catch { setErr(D.errGeneric); }
    finally { setBusy(false); }
  }

  async function importCnpjs(cnpjs: string[]) {
    if (!cnpjs.length || importing) return;
    setImporting(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("extract-cnpj", { body: { cnpjs, mode: "import" } });
      if (error || res?.error) return;
      setAdded((prev) => { const n = new Set(prev); cnpjs.forEach((c) => n.add(c)); return n; });
      setSelected(new Set());
      if (res.quota) setData((d) => (d ? { ...d, quota: res.quota } : d));
      await refresh();
    } finally { setImporting(false); }
  }

  const quota = data?.quota;
  const rows = data?.results ?? [];
  const newCount = rows.filter((r) => !r.duplicate).length;
  const dupCount = rows.length - newCount;
  const selCount = selected.size;
  const remaining = quota && quota.limit != null ? Math.max(0, quota.limit - quota.used) : Infinity;
  const exceeds = quota != null && quota.limit != null && quota.used + selCount > quota.limit;
  const atLimit = quota != null && quota.limit != null && quota.used >= quota.limit;

  function toggle(cnpj: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(cnpj) ? n.delete(cnpj) : n.add(cnpj); return n; });
  }
  function selectNew() {
    setSelected(new Set(rows.filter((r) => !isDupe(r)).map((r) => r.cnpj)));
  }

  return (
    <div className="ml-fade" style={{ maxWidth: 900, margin: "8px auto 0", display: "flex", flexDirection: "column", gap: 22 }}>
      {/* card de busca */}
      <Panel style={{ padding: 32, borderRadius: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: "rgba(76,46,224,.12)", color: "var(--ml-primary)", display: "grid", placeItems: "center" }}><Icon name="building" size={24} /></div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800 }}>{D.title}</div>
            <div style={{ fontSize: 13.5, color: "var(--ml-muted)" }}>{D.sub}</div>
          </div>
        </div>

        <label style={lbl}>{D.label}</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={D.ph} rows={4}
          style={{ ...inp, height: 120, padding: "12px 14px", lineHeight: 1.7, resize: "vertical", fontFamily: "inherit" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, fontSize: 12.5, minHeight: 18 }}>
          {parsed.valid.length > 0 && <span style={{ color: "var(--ml-green)", fontWeight: 700 }}><b>{parsed.valid.length}</b> {D.detected}</span>}
          {parsed.invalid > 0 && <span style={{ color: "var(--ml-muted)" }}><b>{parsed.invalid}</b> {D.invalidCount}</span>}
          {text.trim() !== "" && <button onClick={() => { setText(""); setData(null); }} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--ml-muted)", cursor: "pointer", fontSize: 12.5, display: "flex", alignItems: "center", gap: 5 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ml-red)")} onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ml-muted)")}><Icon name="x" size={13} strokeWidth={2.2} />{D.clear}</button>}
        </div>

        <button onClick={runLookup} disabled={busy} style={{ width: "100%", height: 50, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 13, border: "none", background: "linear-gradient(135deg,#4c2ee0,#6d4bff)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, boxShadow: "0 10px 24px rgba(76,46,224,.32)" }}>
          {busy ? <Icon name="loader" size={17} className="ml-spin" /> : <Icon name="search" size={17} />}{busy ? D.searching : D.search}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, padding: "12px 14px", borderRadius: 11, background: "var(--ml-hover)", fontSize: 13, color: "var(--ml-muted)" }}>
          <Icon name="info" size={16} />{D.info}
        </div>
        {err && <div style={{ marginTop: 14, fontSize: 13.5, color: "var(--ml-red)", background: "rgba(239,68,68,.1)", padding: "11px 13px", borderRadius: 10, lineHeight: 1.5 }}>{err}</div>}
      </Panel>

      {/* exemplos */}
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ml-muted)", marginBottom: 10 }}>{D.examples}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {EXAMPLES.map((ex) => (
            <button key={ex.cnpj} onClick={() => setText((t) => (t.trim() ? t.replace(/\s*$/, "") + "\n" : "") + ex.cnpj)} style={chip}><Icon name="building" size={14} />{ex.name}</button>
          ))}
        </div>
      </div>

      {/* resultado = staging */}
      {data && (
        <Panel>
          {/* cabeçalho */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(16,185,129,.14)", display: "grid", placeItems: "center", color: "var(--ml-green)", flexShrink: 0 }}><Icon name="check" size={18} /></div>
            <div style={{ fontWeight: 800, fontSize: 16, flex: 1 }}>{D.done}</div>
            <div style={{ fontSize: 13, display: "flex", gap: 12 }}>
              <span style={{ color: "var(--ml-green)", fontWeight: 700 }}>{newCount} {D.newLeads}</span>
              {dupCount > 0 && <span style={{ color: "var(--ml-muted)" }}>{dupCount} {D.dups}</span>}
            </div>
          </div>

          {/* barra de cota */}
          {quota && <QuotaBar quota={quota} selCount={selCount} D={D} />}

          {rows.length === 0 ? (
            <div style={{ fontSize: 13.5, color: "var(--ml-muted)", padding: "8px 2px" }}>{D.noEmpty}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {rows.map((r) => {
                const dupe = isDupe(r);
                const on = selected.has(r.cnpj);
                const sm = SIT_META[r.situacaoKey] ?? SIT_META.other;
                return (
                  <div key={r.cnpj} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 12, border: "1px solid var(--ml-border)", background: on ? "rgba(76,46,224,.05)" : "var(--ml-card)", transition: ".12s" }}>
                    {/* checkbox */}
                    <button onClick={() => !dupe && toggle(r.cnpj)} disabled={dupe} aria-label="select" style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 6, border: `1.6px solid ${on ? "var(--ml-primary)" : "var(--ml-border)"}`, background: on ? "var(--ml-primary)" : "transparent", display: "grid", placeItems: "center", cursor: dupe ? "not-allowed" : "pointer", opacity: dupe ? 0.4 : 1, padding: 0 }}>
                      {on && <Icon name="check" size={13} strokeWidth={3} style={{ color: "#fff" }} />}
                    </button>
                    {/* bloco clicável → drawer */}
                    <button onClick={() => setDrawer(r)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ml-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{r.company}</span>
                        <Badge color={dupe ? "var(--ml-muted)" : "#059669"} bg={dupe ? "var(--ml-grid)" : "rgba(16,185,129,.13)"}>{dupe ? D.badgeExists : D.badgeNew}</Badge>
                        <Badge color={sm.color} bg={sm.bg}>{D.sit[r.situacaoKey] ?? r.situacao}</Badge>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ml-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{[r.razao_social, r.cnae].filter(Boolean).join(" · ")}</div>
                    </button>
                    {/* telefone + ver detalhe */}
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                      <span style={{ fontSize: 12.5, color: "var(--ml-muted)", whiteSpace: "nowrap" }}>{r.phone || "—"}</span>
                      <button onClick={() => setDrawer(r)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--ml-primary)", fontWeight: 600, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}>{D.detail} <span style={{ fontSize: 14 }}>→</span></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* aviso de limite */}
          {(exceeds || (atLimit && selCount > 0)) && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, fontSize: 13, color: "var(--ml-red)", background: "rgba(239,68,68,.09)", border: "1px solid rgba(239,68,68,.22)", padding: "12px 14px", borderRadius: 12 }}>
              <Icon name="info" size={16} />
              <span style={{ flex: 1 }}>{atLimit ? `${D.limitHit} ${cap(quota!.plan)}.` : `${D.limitExceed} ${remaining}).`}</span>
              <button onClick={() => onNavigate?.("sub")} style={{ background: "none", border: "none", color: "var(--ml-red)", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>{D.upgrade} →</button>
            </div>
          )}

          {/* rodapé de ações */}
          {rows.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <button onClick={selectNew} disabled={newCount === 0} style={{ ...ghostBtn, opacity: newCount === 0 ? 0.5 : 1, cursor: newCount === 0 ? "default" : "pointer" }}>{D.selNew}</button>
              <button onClick={() => onNavigate?.("leadslist")} style={ghostBtn}><Icon name="users" size={15} />{D.goLeads}</button>
              <button onClick={() => importCnpjs([...selected])} disabled={selCount === 0 || exceeds || importing}
                style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#4c2ee0,#6d4bff)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: selCount === 0 || exceeds || importing ? "default" : "pointer", opacity: selCount === 0 || exceeds || importing ? 0.55 : 1, boxShadow: "0 8px 18px rgba(76,46,224,.28)" }}>
                {importing ? <Icon name="loader" size={16} className="ml-spin" /> : <Icon name="plus" size={16} strokeWidth={2.4} />}{D.addN} ({selCount})
              </button>
            </div>
          )}
        </Panel>
      )}

      {drawer && (() => {
        const sm = SIT_META[drawer.situacaoKey] ?? SIT_META.other;
        const badges: BadgeT[] = [
          { label: isDupe(drawer) ? D.badgeExists : D.badgeNew, color: isDupe(drawer) ? "var(--ml-muted)" : "#059669", bg: isDupe(drawer) ? "var(--ml-grid)" : "rgba(16,185,129,.13)" },
          { label: D.sit[drawer.situacaoKey] ?? drawer.situacao, color: sm.color, bg: sm.bg },
        ];
        const data: StagingCompany = {
          cnpj: drawer.cnpj, cnpjFmt: drawer.cnpjFmt, company: drawer.company,
          razao_social: drawer.razao_social, nome_fantasia: drawer.nome_fantasia,
          cnae: drawer.cnae, porte: drawer.porte, abertura: drawer.abertura, capital: drawer.capital,
          municipio: drawer.location, email: drawer.email, phone: drawer.phone, address: drawer.address,
        };
        return <StagingDetailModal data={data} badges={badges} added={isDupe(drawer)} importing={importing} onAdd={() => importCnpjs([drawer.cnpj])} onClose={() => setDrawer(null)} lang={lang} />;
      })()}
    </div>
  );
}

function QuotaBar({ quota, selCount, D }: { quota: Quota; selCount: number; D: typeof DICT["pt"] }) {
  const unlimited = quota.limit == null;
  const pct = unlimited ? 0 : Math.min(100, (quota.used / quota.limit!) * 100);
  const projPct = unlimited ? 0 : Math.min(100, ((quota.used + selCount) / quota.limit!) * 100);
  const band = pct >= 90 ? "#dc2626" : pct >= 70 ? "#f59e0b" : "#4c2ee0";
  const selPct = unlimited || selCount === 0 ? 0 : Math.round((selCount / quota.limit!) * 100);
  return (
    <div style={{ background: "var(--ml-hover)", border: "1px solid var(--ml-border)", borderRadius: 13, padding: "13px 15px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, marginBottom: 9 }}>
        <span style={{ color: "var(--ml-muted)" }}>{D.quotaLabel} <b style={{ color: "var(--ml-text)", textTransform: "capitalize" }}>{quota.plan}</b> · {D.quotaMonth}</span>
        <span style={{ fontWeight: 700, color: "var(--ml-text)" }}>{unlimited ? <span style={{ color: "var(--ml-primary)" }}>{D.unlimited}</span> : <>{quota.used} <span style={{ color: "var(--ml-muted)", fontWeight: 500 }}>{D.quotaOf} {quota.limit}</span></>}</span>
      </div>
      {!unlimited && (
        <div style={{ height: 8, borderRadius: 20, background: "var(--ml-grid)", overflow: "hidden", position: "relative" }}>
          {selCount > 0 && <div style={{ position: "absolute", inset: 0, width: `${projPct}%`, background: "rgba(76,46,224,.28)", borderRadius: 20 }} />}
          <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: band, borderRadius: 20, transition: "width .3s" }} />
        </div>
      )}
      {!unlimited && selCount > 0 && (
        <div style={{ fontSize: 12, color: "var(--ml-primary)", fontWeight: 600, marginTop: 8 }}>+{selCount} {D.willUse} · {selPct}% {D.ofQuota}</div>
      )}
    </div>
  );
}

function Badge({ children, color, bg }: { children: ReactNode; color: string; bg: string }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color, background: bg, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{children}</span>;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lbl: CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ml-navtext)", marginBottom: 7 };
const inp: CSSProperties = { width: "100%", borderRadius: 12, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", fontSize: 14, outline: "none" };
const chip: CSSProperties = { display: "flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 20, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const ghostBtn: CSSProperties = { display: "flex", alignItems: "center", gap: 7, height: 44, padding: "0 16px", borderRadius: 12, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" };
