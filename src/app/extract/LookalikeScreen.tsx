import { useState, type CSSProperties, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "../LangTheme";
import { useAuth } from "../AuthContext";
import { Icon } from "../icons";
import type { ScreenKey } from "@/i18n/ml";
import { StagingDetailModal, type StagingCompany, type Badge as BadgeT } from "./StagingDetailModal";

// "Espelhar clientes" (lookalike): cola CNPJs dos melhores clientes → detecta o padrão
// (CNAE + porte via BrasilAPI, grátis) → busca empresas recém-abertas com o mesmo perfil.
const DICT = {
  pt: {
    title: "Espelhar Clientes", sub: "Ache empresas parecidas com os seus melhores clientes",
    seedLabel: "CNPJs dos seus melhores clientes", seedPh: "Cole 1 a 5 CNPJs, um por linha.\nEx: 33.000.167/0001-01",
    analyze: "Analisar padrão", analyzing: "Analisando…", patternTitle: "Padrão detectado", cnaeLbl: "Atividades (CNAE)", seedsLbl: "Baseado em",
    uf: "Estado (UF)", all: "Todos", search: "Buscar semelhantes", searching: "Buscando…", found: "semelhantes encontradas",
    info: "Detectamos o CNAE e o porte dos clientes que você colou e buscamos empresas recém-abertas com o mesmo perfil.",
    reqSeed: "Cole ao menos um CNPJ válido.", noPattern: "Não consegui detectar o padrão desses CNPJs. Confira os números.",
    errGeneric: "Não foi possível buscar agora.", none: "Nenhuma empresa semelhante encontrada. Tente outro estado ou CNAE.",
    quotaLabel: "Plano", quotaMonth: "leads extraídos este mês", quotaOf: "de", unlimited: "ilimitado", willUse: "vão usar", ofQuota: "da sua cota",
    selNew: "Selecionar novos", goLeads: "Ver na lista de Leads", addN: "Adicionar à lista",
    limitHit: "Você atingiu o limite do plano", limitExceed: "Essa seleção passa do seu limite (cabem mais", upgrade: "Fazer upgrade",
    badgeNew: "novo", badgeExists: "já existe", badgeMei: "MEI", detail: "Ver detalhe", prev: "Anterior", next: "Próximo", page: "Página", clear: "Limpar",
  },
  en: {
    title: "Mirror Clients", sub: "Find companies similar to your best clients",
    seedLabel: "CNPJs of your best clients", seedPh: "Paste 1 to 5 CNPJs, one per line.\nEx: 33.000.167/0001-01",
    analyze: "Analyze pattern", analyzing: "Analyzing…", patternTitle: "Detected pattern", cnaeLbl: "Activities (CNAE)", seedsLbl: "Based on",
    uf: "State (UF)", all: "All", search: "Find similar", searching: "Searching…", found: "similar found",
    info: "We detect the CNAE and size of the clients you pasted and search for newly opened companies with the same profile.",
    reqSeed: "Paste at least one valid CNPJ.", noPattern: "Couldn't detect a pattern from those CNPJs. Check the numbers.",
    errGeneric: "Couldn't search right now.", none: "No similar company found. Try another state or CNAE.",
    quotaLabel: "Plan", quotaMonth: "leads extracted this month", quotaOf: "of", unlimited: "unlimited", willUse: "will use", ofQuota: "of your quota",
    selNew: "Select new", goLeads: "View in Leads list", addN: "Add to list",
    limitHit: "You reached the limit of the plan", limitExceed: "This selection exceeds your limit (only", upgrade: "Upgrade",
    badgeNew: "new", badgeExists: "exists", badgeMei: "MEI", detail: "View detail", prev: "Previous", next: "Next", page: "Page", clear: "Clear",
  },
  es: {
    title: "Espejar Clientes", sub: "Encuentra empresas similares a tus mejores clientes",
    seedLabel: "CNPJs de tus mejores clientes", seedPh: "Pega 1 a 5 CNPJs, uno por línea.\nEj: 33.000.167/0001-01",
    analyze: "Analizar patrón", analyzing: "Analizando…", patternTitle: "Patrón detectado", cnaeLbl: "Actividades (CNAE)", seedsLbl: "Basado en",
    uf: "Estado (UF)", all: "Todos", search: "Buscar similares", searching: "Buscando…", found: "similares encontradas",
    info: "Detectamos el CNAE y el tamaño de los clientes que pegaste y buscamos empresas recién abiertas con el mismo perfil.",
    reqSeed: "Pega al menos un CNPJ válido.", noPattern: "No pude detectar el patrón de esos CNPJs. Revisa los números.",
    errGeneric: "No se pudo buscar ahora.", none: "No se encontró empresa similar. Prueba otro estado o CNAE.",
    quotaLabel: "Plan", quotaMonth: "leads extraídos este mes", quotaOf: "de", unlimited: "ilimitado", willUse: "usarán", ofQuota: "de tu cuota",
    selNew: "Seleccionar nuevos", goLeads: "Ver en la lista de Leads", addN: "Añadir a la lista",
    limitHit: "Alcanzaste el límite del plan", limitExceed: "Esta selección supera tu límite (caben", upgrade: "Mejorar plan",
    badgeNew: "nuevo", badgeExists: "ya existe", badgeMei: "MEI", detail: "Ver detalle", prev: "Anterior", next: "Siguiente", page: "Página", clear: "Limpiar",
  },
};

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

type Row = {
  cnpj: string; cnpjFmt: string; company: string; razao_social: string; nome_fantasia: string;
  cnae: string | null; porte: string | null; mei: boolean; abertura: string | null; capital: string | null;
  uf: string | null; municipio: string | null; email: string | null; phone: string | null; situacao: string | null; duplicate: boolean;
};
type Quota = { used: number; limit: number | null; plan: string; isAdmin: boolean };
type Seed = { cnpj: string; razao: string; cnae: string; porte: string | null };
type Pattern = { cnaes: { codigo: string; descricao: string }[]; seeds: Seed[] };

const onlyDigits = (s: string) => s.replace(/\D/g, "");
const titleCase = (s?: string | null) => (s ? String(s).toLowerCase().replace(/(^|[\s\-/(])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase()) : "");
const PORTE_LBL: Record<string, string> = { "01": "ME", "1": "ME", "03": "EPP", "3": "EPP", "05": "Demais", "5": "Demais" };

export function LookalikeScreen({ onNavigate }: { onNavigate?: (s: ScreenKey) => void }) {
  const { lang } = useLang();
  const { refresh } = useAuth();
  const D = DICT[lang];

  const [seeds, setSeeds] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [pattern, setPattern] = useState<Pattern | null>(null);
  const [patternErr, setPatternErr] = useState<string | null>(null);
  const [uf, setUf] = useState("");

  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [drawer, setDrawer] = useState<Row | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const PAGE_SIZE = 50;
  const isDupe = (r: Row) => r.duplicate || added.has(r.cnpj);

  async function analyze() {
    setPatternErr(null); setPattern(null); setRows(null);
    const cnpjs = [...new Set(seeds.split(/[\s,;]+/).map(onlyDigits).filter((c) => c.length === 14))].slice(0, 5);
    if (!cnpjs.length) { setPatternErr(D.reqSeed); return; }
    setAnalyzing(true);
    try {
      const got: Seed[] = [];
      const cnaeDesc = new Map<string, string>();
      for (const c of cnpjs) {
        try {
          const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`);
          if (!r.ok) continue;
          const j = await r.json();
          const code = j.cnae_fiscal ? String(j.cnae_fiscal).padStart(7, "0") : "";
          if (!code) continue;
          if (!cnaeDesc.has(code)) cnaeDesc.set(code, titleCase(j.cnae_fiscal_descricao) || code);
          got.push({ cnpj: c, razao: titleCase(j.razao_social || j.nome_fantasia), cnae: code, porte: j.porte ? String(j.porte) : null });
        } catch { /* ignora */ }
      }
      if (!got.length) { setPatternErr(D.noPattern); return; }
      const cnaes = [...cnaeDesc.entries()].map(([codigo, descricao]) => ({ codigo, descricao }));
      setPattern({ cnaes, seeds: got });
    } finally { setAnalyzing(false); }
  }

  async function runSearch(toPage = 0) {
    if (!pattern) return;
    setErr(null); setBusy(true);
    try {
      const filters = { cnaes: pattern.cnaes.map((c) => c.codigo), uf: uf || undefined, days: 60 };
      const { data: res, error } = await supabase.functions.invoke("search-receita", { body: { mode: "search", filters, page: toPage } });
      if (error || res?.error) { setErr(D.errGeneric); setRows([]); return; }
      setRows(res.results ?? []); setTotal(res.total ?? 0); setPage(toPage);
      if (res.quota) setQuota(res.quota);
    } catch { setErr(D.errGeneric); setRows([]); }
    finally { setBusy(false); }
  }

  async function importCnpjs(cnpjs: string[]) {
    if (!cnpjs.length || importing) return;
    setImporting(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("search-receita", { body: { mode: "import", cnpjs } });
      if (error || res?.error) return;
      setAdded((prev) => { const n = new Set(prev); cnpjs.forEach((c) => n.add(c)); return n; });
      setSelected(new Set());
      if (res.quota) setQuota(res.quota);
      await refresh();
    } finally { setImporting(false); }
  }

  const list = rows ?? [];
  const selCount = selected.size;
  const remaining = quota && quota.limit != null ? Math.max(0, quota.limit - quota.used) : Infinity;
  const exceeds = quota != null && quota.limit != null && quota.used + selCount > quota.limit;
  const atLimit = quota != null && quota.limit != null && quota.used >= quota.limit;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggle(cnpj: string) { setSelected((prev) => { const n = new Set(prev); n.has(cnpj) ? n.delete(cnpj) : n.add(cnpj); return n; }); }
  function selectNew() { setSelected((prev) => { const n = new Set(prev); list.filter((r) => !isDupe(r)).forEach((r) => n.add(r.cnpj)); return n; }); }

  return (
    <div className="ml-fade" style={{ maxWidth: 920, margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
      {/* card sementes */}
      <Panel style={{ padding: 28, borderRadius: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: "rgba(109,92,245,.12)", color: "var(--ml-primary)", display: "grid", placeItems: "center" }}><Icon name="users" size={24} /></div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800 }}>{D.title}</div>
            <div style={{ fontSize: 13.5, color: "var(--ml-muted)" }}>{D.sub}</div>
          </div>
        </div>

        <label style={lbl}>{D.seedLabel}</label>
        <textarea value={seeds} onChange={(e) => { setSeeds(e.target.value); setPatternErr(null); }} placeholder={D.seedPh} rows={3}
          style={{ ...inp, height: 96, padding: "12px 14px", lineHeight: 1.7, resize: "vertical", fontFamily: "inherit" }} />

        <button onClick={analyze} disabled={analyzing} style={{ width: "100%", height: 48, marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 13, border: "none", background: "linear-gradient(135deg,#6d5cf5,#8b6bff)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: analyzing ? "default" : "pointer", opacity: analyzing ? 0.7 : 1, boxShadow: "0 10px 24px rgba(109,92,245,.32)" }}>
          {analyzing ? <Icon name="loader" size={17} className="ml-spin" /> : <Icon name="spark" size={17} />}{analyzing ? D.analyzing : D.analyze}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "12px 14px", borderRadius: 11, background: "var(--ml-hover)", fontSize: 13, color: "var(--ml-muted)" }}>
          <Icon name="info" size={16} />{D.info}
        </div>
        {patternErr && <div style={{ marginTop: 12, fontSize: 13.5, color: "var(--ml-red)", background: "rgba(239,68,68,.1)", padding: "11px 13px", borderRadius: 10 }}>{patternErr}</div>}
      </Panel>

      {/* padrão detectado + busca */}
      {pattern && (
        <Panel>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ml-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>{D.patternTitle}</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ml-muted)", marginBottom: 6 }}>{D.cnaeLbl}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {pattern.cnaes.map((c) => <Badge key={c.codigo} color="#6d5cf5" bg="rgba(109,92,245,.1)">{c.descricao}</Badge>)}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ml-muted)", marginBottom: 6 }}>{D.seedsLbl}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {pattern.seeds.map((s) => <span key={s.cnpj} style={{ fontSize: 12, color: "var(--ml-text)", background: "var(--ml-grid)", border: "1px solid var(--ml-border)", padding: "3px 10px", borderRadius: 16 }}>{s.razao}{s.porte && PORTE_LBL[s.porte] ? ` · ${PORTE_LBL[s.porte]}` : ""}</span>)}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 150 }}>
              <label style={lbl}>{D.uf}</label>
              <select value={uf} onChange={(e) => setUf(e.target.value)} style={{ ...inp, height: 42, padding: "0 12px" }}>
                <option value="">{D.all}</option>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <button onClick={() => runSearch(0)} disabled={busy} style={{ flex: 1, minWidth: 180, height: 46, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 12, border: "none", background: "linear-gradient(135deg,#6d5cf5,#8b6bff)", color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, boxShadow: "0 8px 18px rgba(109,92,245,.28)" }}>
              {busy ? <Icon name="loader" size={16} className="ml-spin" /> : <Icon name="search" size={16} />}{busy ? D.searching : D.search}
            </button>
          </div>
        </Panel>
      )}

      {/* resultados */}
      {rows && (
        <Panel>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(16,185,129,.14)", display: "grid", placeItems: "center", color: "var(--ml-green)", flexShrink: 0 }}><Icon name="check" size={18} /></div>
            <div style={{ fontWeight: 800, fontSize: 16, flex: 1 }}>{total} {D.found}</div>
          </div>

          {quota && <QuotaBar quota={quota} selCount={selCount} D={D} />}

          {list.length === 0 ? (
            <div style={{ fontSize: 13.5, color: "var(--ml-muted)", padding: "8px 2px" }}>{err ?? D.none}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {list.map((r) => {
                const dupe = isDupe(r);
                const on = selected.has(r.cnpj);
                return (
                  <div key={r.cnpj} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 12, border: "1px solid var(--ml-border)", background: on ? "rgba(109,92,245,.05)" : "var(--ml-card)" }}>
                    <button onClick={() => !dupe && toggle(r.cnpj)} disabled={dupe} aria-label="select" style={{ width: 20, height: 20, flexShrink: 0, borderRadius: 6, border: `1.6px solid ${on ? "var(--ml-primary)" : "var(--ml-border)"}`, background: on ? "var(--ml-primary)" : "transparent", display: "grid", placeItems: "center", cursor: dupe ? "not-allowed" : "pointer", opacity: dupe ? 0.4 : 1, padding: 0 }}>
                      {on && <Icon name="check" size={13} strokeWidth={3} style={{ color: "#fff" }} />}
                    </button>
                    <button onClick={() => setDrawer(r)} style={{ flex: 1, minWidth: 0, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ml-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{r.company}</span>
                        <Badge color={dupe ? "var(--ml-muted)" : "#059669"} bg={dupe ? "var(--ml-grid)" : "rgba(16,185,129,.13)"}>{dupe ? D.badgeExists : D.badgeNew}</Badge>
                        {r.mei && <Badge color="#6d5cf5" bg="rgba(109,92,245,.1)">{D.badgeMei}</Badge>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ml-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[r.cnae, [r.municipio, r.uf].filter(Boolean).join("/"), r.abertura].filter(Boolean).join(" · ")}
                      </div>
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                      {r.email && <span style={{ color: "var(--ml-green)", flexShrink: 0 }} title={r.email}><Icon name="mail" size={15} /></span>}
                      <span style={{ fontSize: 12.5, color: "var(--ml-muted)", whiteSpace: "nowrap" }}>{r.phone || "—"}</span>
                      <button onClick={() => setDrawer(r)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--ml-primary)", fontWeight: 600, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap" }}>{D.detail} <span style={{ fontSize: 14 }}>→</span></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(exceeds || (atLimit && selCount > 0)) && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, fontSize: 13, color: "var(--ml-red)", background: "rgba(239,68,68,.09)", border: "1px solid rgba(239,68,68,.22)", padding: "12px 14px", borderRadius: 12 }}>
              <Icon name="info" size={16} />
              <span style={{ flex: 1 }}>{atLimit ? `${D.limitHit} ${cap(quota!.plan)}.` : `${D.limitExceed} ${remaining}).`}</span>
              <button onClick={() => onNavigate?.("sub")} style={{ background: "none", border: "none", color: "var(--ml-red)", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>{D.upgrade} →</button>
            </div>
          )}

          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 16 }}>
              <button onClick={() => runSearch(page - 1)} disabled={page <= 0 || busy} style={{ ...ghostBtn, opacity: page <= 0 ? 0.5 : 1 }}>← {D.prev}</button>
              <span style={{ fontSize: 13, color: "var(--ml-muted)" }}>{D.page} {page + 1}/{totalPages}</span>
              <button onClick={() => runSearch(page + 1)} disabled={page + 1 >= totalPages || busy} style={{ ...ghostBtn, opacity: page + 1 >= totalPages ? 0.5 : 1 }}>{D.next} →</button>
            </div>
          )}

          {list.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
              <button onClick={selectNew} style={ghostBtn}>{D.selNew}</button>
              <button onClick={() => onNavigate?.("leadslist")} style={ghostBtn}><Icon name="users" size={15} />{D.goLeads}</button>
              <button onClick={() => importCnpjs([...selected])} disabled={selCount === 0 || exceeds || importing}
                style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#6d5cf5,#8b6bff)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: selCount === 0 || exceeds || importing ? "default" : "pointer", opacity: selCount === 0 || exceeds || importing ? 0.55 : 1, boxShadow: "0 8px 18px rgba(109,92,245,.28)" }}>
                {importing ? <Icon name="loader" size={16} className="ml-spin" /> : <Icon name="plus" size={16} strokeWidth={2.4} />}{D.addN} ({selCount})
              </button>
            </div>
          )}
        </Panel>
      )}

      {drawer && (() => {
        const dupe = isDupe(drawer);
        const badges: BadgeT[] = [{ label: dupe ? D.badgeExists : D.badgeNew, color: dupe ? "var(--ml-muted)" : "#059669", bg: dupe ? "var(--ml-grid)" : "rgba(16,185,129,.13)" }];
        if (drawer.situacao) badges.push({ label: drawer.situacao, color: "#059669", bg: "rgba(16,185,129,.13)" });
        if (drawer.mei) badges.push({ label: D.badgeMei, color: "#6d5cf5", bg: "rgba(109,92,245,.1)" });
        const data: StagingCompany = {
          cnpj: drawer.cnpj, cnpjFmt: drawer.cnpjFmt, company: drawer.company, razao_social: drawer.razao_social, nome_fantasia: drawer.nome_fantasia,
          cnae: drawer.cnae, porte: drawer.porte, abertura: drawer.abertura, capital: drawer.capital, uf: drawer.uf, municipio: drawer.municipio, mei: drawer.mei, email: drawer.email, phone: drawer.phone,
        };
        return <StagingDetailModal data={data} badges={badges} added={dupe} importing={importing} onAdd={() => importCnpjs([drawer.cnpj])} onClose={() => setDrawer(null)} lang={lang} />;
      })()}
    </div>
  );
}

const Panel = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 20, padding: 20, boxShadow: "0 1px 3px rgba(30,25,60,.04)", ...style }}>{children}</div>
);
function QuotaBar({ quota, selCount, D }: { quota: Quota; selCount: number; D: typeof DICT["pt"] }) {
  const unlimited = quota.limit == null;
  const pct = unlimited ? 0 : Math.min(100, (quota.used / quota.limit!) * 100);
  const projPct = unlimited ? 0 : Math.min(100, ((quota.used + selCount) / quota.limit!) * 100);
  const band = pct >= 90 ? "#dc2626" : pct >= 70 ? "#f59e0b" : "#6d5cf5";
  const selPct = unlimited || selCount === 0 ? 0 : Math.round((selCount / quota.limit!) * 100);
  return (
    <div style={{ background: "var(--ml-hover)", border: "1px solid var(--ml-border)", borderRadius: 13, padding: "13px 15px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5, marginBottom: 9 }}>
        <span style={{ color: "var(--ml-muted)" }}>{D.quotaLabel} <b style={{ color: "var(--ml-text)", textTransform: "capitalize" }}>{quota.plan}</b> · {D.quotaMonth}</span>
        <span style={{ fontWeight: 700, color: "var(--ml-text)" }}>{unlimited ? <span style={{ color: "var(--ml-primary)" }}>{D.unlimited}</span> : <>{quota.used} <span style={{ color: "var(--ml-muted)", fontWeight: 500 }}>{D.quotaOf} {quota.limit}</span></>}</span>
      </div>
      {!unlimited && (
        <div style={{ height: 8, borderRadius: 20, background: "var(--ml-grid)", overflow: "hidden", position: "relative" }}>
          {selCount > 0 && <div style={{ position: "absolute", inset: 0, width: `${projPct}%`, background: "rgba(109,92,245,.28)", borderRadius: 20 }} />}
          <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: band, borderRadius: 20, transition: "width .3s" }} />
        </div>
      )}
      {!unlimited && selCount > 0 && <div style={{ fontSize: 12, color: "var(--ml-primary)", fontWeight: 600, marginTop: 8 }}>+{selCount} {D.willUse} · {selPct}% {D.ofQuota}</div>}
    </div>
  );
}
function Badge({ children, color, bg }: { children: ReactNode; color: string; bg: string }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color, background: bg, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{children}</span>;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lbl: CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ml-navtext)", marginBottom: 7 };
const inp: CSSProperties = { width: "100%", borderRadius: 12, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", fontSize: 14, outline: "none" };
const ghostBtn: CSSProperties = { display: "flex", alignItems: "center", gap: 7, height: 44, padding: "0 16px", borderRadius: 12, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" };
