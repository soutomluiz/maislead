import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "../LangTheme";
import { useAuth } from "../AuthContext";
import { Icon } from "../icons";
import type { ScreenKey } from "@/i18n/ml";

const Panel = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 20, padding: 20, boxShadow: "0 1px 3px rgba(30,25,60,.04)", ...style }}>{children}</div>
);

const DICT = {
  pt: {
    title: "Empresas Recém-Abertas", sub: "Empresas que abriram recentemente, direto da base da Receita",
    uf: "Estado (UF)", cnae: "Atividade (CNAE)", cnaePh: "Código, ex: 5611201", window: "Abertas nos últimos", days30: "30 dias", days60: "60 dias",
    mei: "MEI", meiAll: "Todos", meiOnly: "Só MEI", meiNo: "Sem MEI", onlyEmail: "Só com e-mail", q: "Nome", qPh: "Filtrar por nome…", all: "Todos",
    search: "Buscar empresas", searching: "Buscando…", found: "encontradas", none: "Nenhuma empresa encontrada com esses filtros. Ajuste e tente de novo.",
    info: "A base é atualizada mensalmente. 'Recém-aberta' = abriu nos últimos 30/60 dias em relação à última atualização.",
    empty: "Defina os filtros e clique em Buscar.", errGeneric: "Não foi possível buscar agora. A base já foi carregada?",
    quotaLabel: "Plano", quotaMonth: "leads extraídos este mês", quotaOf: "de", unlimited: "ilimitado", willUse: "vão usar", ofQuota: "da sua cota",
    selNew: "Selecionar novos", goLeads: "Ver na lista de Leads", addN: "Adicionar à lista",
    limitHit: "Você atingiu o limite do plano", limitExceed: "Essa seleção passa do seu limite (cabem mais", upgrade: "Fazer upgrade",
    badgeNew: "novo", badgeExists: "já existe", badgeMei: "MEI", prev: "Anterior", next: "Próximo", page: "Página",
  },
  en: {
    title: "Newly Opened Companies", sub: "Recently registered companies, straight from the registry",
    uf: "State (UF)", cnae: "Activity (CNAE)", cnaePh: "Code, e.g. 5611201", window: "Opened in the last", days30: "30 days", days60: "60 days",
    mei: "MEI", meiAll: "All", meiOnly: "MEI only", meiNo: "No MEI", onlyEmail: "With email only", q: "Name", qPh: "Filter by name…", all: "All",
    search: "Search companies", searching: "Searching…", found: "found", none: "No company found with these filters. Adjust and try again.",
    info: "The base refreshes monthly. 'Newly opened' = opened in the last 30/60 days relative to the last refresh.",
    empty: "Set the filters and click Search.", errGeneric: "Couldn't search now. Has the base been loaded?",
    quotaLabel: "Plan", quotaMonth: "leads extracted this month", quotaOf: "of", unlimited: "unlimited", willUse: "will use", ofQuota: "of your quota",
    selNew: "Select new", goLeads: "View in Leads list", addN: "Add to list",
    limitHit: "You reached the limit of the plan", limitExceed: "This selection exceeds your limit (only", upgrade: "Upgrade",
    badgeNew: "new", badgeExists: "exists", badgeMei: "MEI", prev: "Previous", next: "Next", page: "Page",
  },
  es: {
    title: "Empresas Recién Abiertas", sub: "Empresas registradas recientemente, directo del registro",
    uf: "Estado (UF)", cnae: "Actividad (CNAE)", cnaePh: "Código, ej: 5611201", window: "Abiertas en los últimos", days30: "30 días", days60: "60 días",
    mei: "MEI", meiAll: "Todos", meiOnly: "Solo MEI", meiNo: "Sin MEI", onlyEmail: "Solo con email", q: "Nombre", qPh: "Filtrar por nombre…", all: "Todos",
    search: "Buscar empresas", searching: "Buscando…", found: "encontradas", none: "No se encontró empresa con estos filtros. Ajusta e intenta de nuevo.",
    info: "La base se actualiza mensualmente. 'Recién abierta' = abrió en los últimos 30/60 días respecto a la última actualización.",
    empty: "Define los filtros y haz clic en Buscar.", errGeneric: "No se pudo buscar ahora. ¿La base ya fue cargada?",
    quotaLabel: "Plan", quotaMonth: "leads extraídos este mes", quotaOf: "de", unlimited: "ilimitado", willUse: "usarán", ofQuota: "de tu cuota",
    selNew: "Seleccionar nuevos", goLeads: "Ver en la lista de Leads", addN: "Añadir a la lista",
    limitHit: "Alcanzaste el límite del plan", limitExceed: "Esta selección supera tu límite (caben", upgrade: "Mejorar plan",
    badgeNew: "nuevo", badgeExists: "ya existe", badgeMei: "MEI", prev: "Anterior", next: "Siguiente", page: "Página",
  },
};

const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

type Row = {
  cnpj: string; cnpjFmt: string; company: string; razao_social: string; nome_fantasia: string;
  cnae: string | null; porte: string | null; mei: boolean; abertura: string | null; capital: string | null;
  uf: string | null; municipio: string | null; email: string | null; phone: string | null; situacao: string | null; duplicate: boolean;
};
type Quota = { used: number; limit: number | null; plan: string; isAdmin: boolean };
type MeiFilter = "all" | "only" | "no";

export function RecemAbertasScreen({ onNavigate }: { onNavigate?: (s: ScreenKey) => void }) {
  const { lang } = useLang();
  const { refresh } = useAuth();
  const D = DICT[lang];

  const [uf, setUf] = useState("");
  const [cnae, setCnae] = useState("");
  const [days, setDays] = useState<30 | 60>(60);
  const [mei, setMei] = useState<MeiFilter>("all");
  const [onlyEmail, setOnlyEmail] = useState(false);
  const [q, setQ] = useState("");

  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const PAGE_SIZE = 50;
  const filters = useMemo(() => ({
    days, uf: uf || undefined, cnae: cnae.trim() || undefined,
    mei: mei === "all" ? null : mei === "only", onlyEmail: onlyEmail || undefined, q: q.trim() || undefined,
  }), [days, uf, cnae, mei, onlyEmail, q]);

  const isDupe = (r: Row) => r.duplicate || added.has(r.cnpj);

  async function runSearch(toPage = 0) {
    setErr(null); setBusy(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("search-receita", { body: { mode: "search", filters, page: toPage } });
      if (error || res?.error) { setErr(D.errGeneric); setRows([]); return; }
      setRows(res.results ?? []);
      setTotal(res.total ?? 0);
      setPage(toPage);
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

  function toggle(cnpj: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(cnpj) ? n.delete(cnpj) : n.add(cnpj); return n; });
  }
  function selectNew() {
    setSelected((prev) => { const n = new Set(prev); list.filter((r) => !isDupe(r)).forEach((r) => n.add(r.cnpj)); return n; });
  }

  return (
    <div className="ml-fade" style={{ maxWidth: 920, margin: "8px auto 0", display: "flex", flexDirection: "column", gap: 22 }}>
      {/* filtros */}
      <Panel style={{ padding: 28, borderRadius: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: "rgba(109,92,245,.12)", color: "var(--ml-primary)", display: "grid", placeItems: "center" }}><Icon name="spark" size={24} /></div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800 }}>{D.title}</div>
            <div style={{ fontSize: 13.5, color: "var(--ml-muted)" }}>{D.sub}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 14 }}>
          <div>
            <label style={lbl}>{D.uf}</label>
            <select value={uf} onChange={(e) => setUf(e.target.value)} style={{ ...inp, height: 42, padding: "0 12px" }}>
              <option value="">{D.all}</option>
              {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>{D.cnae}</label>
            <input value={cnae} onChange={(e) => setCnae(e.target.value)} placeholder={D.cnaePh} style={{ ...inp, height: 42, padding: "0 12px" }} />
          </div>
          <div>
            <label style={lbl}>{D.mei}</label>
            <select value={mei} onChange={(e) => setMei(e.target.value as MeiFilter)} style={{ ...inp, height: 42, padding: "0 12px" }}>
              <option value="all">{D.meiAll}</option>
              <option value="only">{D.meiOnly}</option>
              <option value="no">{D.meiNo}</option>
            </select>
          </div>
          <div>
            <label style={lbl}>{D.q}</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={D.qPh} style={{ ...inp, height: 42, padding: "0 12px" }} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 16, flexWrap: "wrap" }}>
          {/* janela 30/60 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12.5, color: "var(--ml-muted)" }}>{D.window}</span>
            <div style={{ display: "flex", borderRadius: 10, border: "1px solid var(--ml-border)", overflow: "hidden" }}>
              {([30, 60] as const).map((d) => (
                <button key={d} onClick={() => setDays(d)} style={{ padding: "7px 13px", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 700, background: days === d ? "var(--ml-primary)" : "var(--ml-card)", color: days === d ? "#fff" : "var(--ml-text)" }}>{d === 30 ? D.days30 : D.days60}</button>
              ))}
            </div>
          </div>
          {/* só com e-mail */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: "var(--ml-text)" }}>
            <button onClick={() => setOnlyEmail((v) => !v)} aria-label="only-email" style={{ width: 20, height: 20, borderRadius: 6, border: `1.6px solid ${onlyEmail ? "var(--ml-primary)" : "var(--ml-border)"}`, background: onlyEmail ? "var(--ml-primary)" : "transparent", display: "grid", placeItems: "center", cursor: "pointer", padding: 0 }}>
              {onlyEmail && <Icon name="check" size={13} strokeWidth={3} style={{ color: "#fff" }} />}
            </button>
            {D.onlyEmail}
          </label>
        </div>

        <button onClick={() => runSearch(0)} disabled={busy} style={{ width: "100%", height: 50, marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 13, border: "none", background: "linear-gradient(135deg,#6d5cf5,#8b6bff)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, boxShadow: "0 10px 24px rgba(109,92,245,.32)" }}>
          {busy ? <Icon name="loader" size={17} className="ml-spin" /> : <Icon name="search" size={17} />}{busy ? D.searching : D.search}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, padding: "12px 14px", borderRadius: 11, background: "var(--ml-hover)", fontSize: 13, color: "var(--ml-muted)" }}>
          <Icon name="info" size={16} />{D.info}
        </div>
        {err && <div style={{ marginTop: 14, fontSize: 13.5, color: "var(--ml-red)", background: "rgba(239,68,68,.1)", padding: "11px 13px", borderRadius: 10, lineHeight: 1.5 }}>{err}</div>}
      </Panel>

      {/* resultados */}
      {rows && (
        <Panel>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(16,185,129,.14)", display: "grid", placeItems: "center", color: "var(--ml-green)", flexShrink: 0 }}><Icon name="check" size={18} /></div>
            <div style={{ fontWeight: 800, fontSize: 16, flex: 1 }}>{total} {D.found}</div>
          </div>

          {quota && <QuotaBar quota={quota} selCount={selCount} D={D} />}

          {list.length === 0 ? (
            <div style={{ fontSize: 13.5, color: "var(--ml-muted)", padding: "8px 2px" }}>{D.none}</div>
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ml-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{r.company}</span>
                        <Badge color={dupe ? "var(--ml-muted)" : "#059669"} bg={dupe ? "var(--ml-grid)" : "rgba(16,185,129,.13)"}>{dupe ? D.badgeExists : D.badgeNew}</Badge>
                        {r.mei && <Badge color="#6d5cf5" bg="rgba(109,92,245,.1)">{D.badgeMei}</Badge>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ml-muted)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[r.cnae, [r.municipio, r.uf].filter(Boolean).join("/"), r.abertura].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                      {r.email && <span style={{ color: "var(--ml-green)", flexShrink: 0 }} title={r.email}><Icon name="mail" size={15} /></span>}
                      <span style={{ fontSize: 12.5, color: "var(--ml-muted)", whiteSpace: "nowrap" }}>{r.phone || "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* limite */}
          {(exceeds || (atLimit && selCount > 0)) && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, fontSize: 13, color: "var(--ml-red)", background: "rgba(239,68,68,.09)", border: "1px solid rgba(239,68,68,.22)", padding: "12px 14px", borderRadius: 12 }}>
              <Icon name="info" size={16} />
              <span style={{ flex: 1 }}>{atLimit ? `${D.limitHit} ${cap(quota!.plan)}.` : `${D.limitExceed} ${remaining}).`}</span>
              <button onClick={() => onNavigate?.("sub")} style={{ background: "none", border: "none", color: "var(--ml-red)", fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>{D.upgrade} →</button>
            </div>
          )}

          {/* paginação */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginTop: 16 }}>
              <button onClick={() => runSearch(page - 1)} disabled={page <= 0 || busy} style={{ ...ghostBtn, opacity: page <= 0 ? 0.5 : 1 }}>← {D.prev}</button>
              <span style={{ fontSize: 13, color: "var(--ml-muted)" }}>{D.page} {page + 1}/{totalPages}</span>
              <button onClick={() => runSearch(page + 1)} disabled={page + 1 >= totalPages || busy} style={{ ...ghostBtn, opacity: page + 1 >= totalPages ? 0.5 : 1 }}>{D.next} →</button>
            </div>
          )}

          {/* rodapé */}
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
    </div>
  );
}

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
const ghostBtn: CSSProperties = { display: "flex", alignItems: "center", gap: 7, height: 44, padding: "0 16px", borderRadius: 12, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" };
