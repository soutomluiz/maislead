import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "../LangTheme";
import { useAuth } from "../AuthContext";
import { Icon, type IconName } from "../icons";
import { LeadDrawer } from "../leads/LeadDrawer";
import { mapLead, type LeadRow, type DbLead } from "../leads/model";
import { CityAutocomplete, type CitySelection } from "./CityAutocomplete";
import { usePlan } from "../plan";

const Panel = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 18, padding: 20, boxShadow: "0 1px 3px rgba(30,25,60,.04)", ...style }}>{children}</div>
);

type Source = "google_maps" | "website";

const DICT = {
  pt: {
    gTitle: "Buscar em Google Places", gSub: "Encontre empresas por nicho e localização no Google Maps",
    wTitle: "Buscar em Websites", wSub: "Rastreie websites por nicho e localização",
    niche: "Nicho de Atuação", nichePh: "Ex: Restaurantes, Academias...", location: "Localização", locPh: "Ex: São Paulo, SP",
    search: "Buscar", searching: "Buscando…", info: "A busca retorna nome, telefone, endereço e website públicos das empresas encontradas.",
    quotaPre: (r: number, c: number) => `Você tem ${r.toLocaleString("pt-BR")} de ${c.toLocaleString("pt-BR")} leads disponíveis este mês`,
    quotaOut: "Você atingiu o limite de leads deste mês",
    popular: "Nichos populares", recent: "Buscas recentes", noRecent: "Nenhuma busca ainda.",
    receive: "O que você recebe", receiveSub: "Cada resultado traz os dados públicos da empresa.",
    reqNiche: "Informe um nicho para buscar.",
    okTitle: "Extração concluída", inserted: "novos leads", skipped: "duplicados ignorados", found: "encontrados", clickDetail: "clique para ver detalhes", goLeads: "Ver na lista de Leads",
    errKey: "A chave de API desta extração ainda não foi configurada no servidor. Assim que você enviar a chave, esta tela passa a extrair de verdade.",
    errLimit: "Limite de leads do seu plano foi atingido este mês. Faça upgrade para continuar extraindo.",
    errPlaces: "O provedor de busca recusou a requisição (verifique a chave/faturamento).", errGeneric: "Não foi possível concluir a extração agora.",
    f_company: "Nome da empresa", f_phone: "Telefone", f_email: "E-mail", f_site: "Website", f_addr: "Endereço", f_rating: "Avaliações",
  },
  en: {
    gTitle: "Search Google Places", gSub: "Find businesses by niche and location on Google Maps",
    wTitle: "Search Websites", wSub: "Crawl websites by niche and location",
    niche: "Niche", nichePh: "E.g.: Restaurants, Gyms...", location: "Location", locPh: "E.g.: New York, NY",
    search: "Search", searching: "Searching…", info: "The search returns public name, phone, address and website of the businesses found.",
    quotaPre: (r: number, c: number) => `You have ${r.toLocaleString("en-US")} of ${c.toLocaleString("en-US")} leads available this month`,
    quotaOut: "You've reached this month's lead limit",
    popular: "Popular niches", recent: "Recent searches", noRecent: "No searches yet.",
    receive: "What you get", receiveSub: "Each result brings the company's public data.",
    reqNiche: "Enter a niche to search.",
    okTitle: "Extraction complete", inserted: "new leads", skipped: "duplicates skipped", found: "found", clickDetail: "click to view details", goLeads: "View in Leads list",
    errKey: "This extraction's API key isn't configured on the server yet. As soon as you send the key, this screen extracts for real.",
    errLimit: "Your plan's monthly lead limit was reached. Upgrade to keep extracting.",
    errPlaces: "The search provider rejected the request (check key/billing).", errGeneric: "Couldn't complete the extraction right now.",
    f_company: "Company name", f_phone: "Phone", f_email: "Email", f_site: "Website", f_addr: "Address", f_rating: "Ratings",
  },
  es: {
    gTitle: "Buscar en Google Places", gSub: "Encuentra empresas por nicho y ubicación en Google Maps",
    wTitle: "Buscar en Sitios Web", wSub: "Rastrea sitios web por nicho y ubicación",
    niche: "Nicho", nichePh: "Ej: Restaurantes, Gimnasios...", location: "Ubicación", locPh: "Ej: Madrid",
    search: "Buscar", searching: "Buscando…", info: "La búsqueda devuelve nombre, teléfono, dirección y web públicos de las empresas encontradas.",
    quotaPre: (r: number, c: number) => `Tienes ${r.toLocaleString("es-ES")} de ${c.toLocaleString("es-ES")} leads disponibles este mes`,
    quotaOut: "Alcanzaste el límite de leads de este mes",
    popular: "Nichos populares", recent: "Búsquedas recientes", noRecent: "Aún no hay búsquedas.",
    receive: "Lo que recibes", receiveSub: "Cada resultado trae los datos públicos de la empresa.",
    reqNiche: "Ingresa un nicho para buscar.",
    okTitle: "Extracción completa", inserted: "nuevos leads", skipped: "duplicados omitidos", found: "encontrados", clickDetail: "haz clic para ver detalles", goLeads: "Ver en la lista de Leads",
    errKey: "La clave de API de esta extracción aún no está configurada en el servidor. En cuanto envíes la clave, esta pantalla extrae de verdad.",
    errLimit: "Se alcanzó el límite mensual de leads de tu plan. Mejora tu plan para seguir extrayendo.",
    errPlaces: "El proveedor de búsqueda rechazó la solicitud (revisa clave/facturación).", errGeneric: "No se pudo completar la extracción ahora.",
    f_company: "Nombre de empresa", f_phone: "Teléfono", f_email: "Email", f_site: "Sitio web", f_addr: "Dirección", f_rating: "Reseñas",
  },
};

const POPULAR = ["Restaurantes", "Academias", "Clínicas", "Madeireiras", "Reformas", "Pisos", "Advocacia", "Estética"];
const POPULAR_ICONS: Record<string, IconName> = { Restaurantes: "database", Academias: "award", Clínicas: "plus", Madeireiras: "database", Reformas: "settings", Pisos: "dashboard", Advocacia: "award", Estética: "spark" };

interface SearchRow { id: string; query: string; location: string | null; count: number; created_at: string; }
interface Preview { company_name: string; phone?: string | null; website?: string | null; email?: string | null; score: number; }

export function ExtractionScreen({ source, fn, onGoLeads }: { source: Source; fn: string; onGoLeads?: () => void }) {
  const { lang } = useLang();
  const { refresh } = useAuth();
  const auth = useAuth();
  const D = DICT[lang];
  // Cota do mês, sempre visível ANTES de buscar (não só depois do resultado).
  const { used, cap, remaining, label: planName } = usePlan();
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  // Cidade selecionada no autocomplete (guarda o bbox pronto pro Overture).
  // Por enquanto só fica no estado — a busca atual continua mandando `location` string.
  const [citySelection, setCitySelection] = useState<CitySelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<SearchRow[]>([]);
  const [result, setResult] = useState<{ inserted: number; skipped: number; found: number; preview: Preview[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [detailLead, setDetailLead] = useState<LeadRow | null>(null);
  const [detailBusy, setDetailBusy] = useState<string | null>(null);

  // Abre o modal de detalhe completo do lead (busca a linha inteira no banco pelo nome/telefone).
  async function openDetail(p: Preview) {
    const acc = auth.account?.id;
    if (!acc || detailBusy) return;
    setDetailBusy(p.company_name);
    try {
      let qb = supabase.from("leads").select("*").eq("account_id", acc).eq("company_name", p.company_name).order("created_at", { ascending: false }).limit(1);
      if (p.phone) qb = qb.eq("phone", p.phone);
      const { data } = await qb;
      if (data && data[0]) setDetailLead(mapLead(data[0] as DbLead));
    } finally { setDetailBusy(null); }
  }

  const title = source === "google_maps" ? D.gTitle : D.wTitle;
  const sub = source === "google_maps" ? D.gSub : D.wSub;

  // Fontes que alimentam ESTA tela. A busca do Google Places pode ser atendida pelo
  // Overture (fonte primária), que grava em `searches` com source="overture" — sem isso
  // o histórico ficava vazio mesmo com as linhas gravadas no banco.
  const recentSources = source === "google_maps" ? ["google_maps", "overture"] : [source];

  async function loadRecent() {
    const acc = auth.account?.id;
    if (!acc) return;
    const { data } = await supabase.from("searches").select("id, query, location, count, created_at").eq("account_id", acc).in("source", recentSources).order("created_at", { ascending: false }).limit(6);
    setRecent((data as SearchRow[]) ?? []);
  }
  useEffect(() => { loadRecent(); /* eslint-disable-next-line */ }, [auth.account?.id, source]);

  // Fluxo antigo: Google Places (extract-google-maps ou o `fn` da prop). Popula result/err.
  async function runGooglePlaces() {
    const { data, error } = await supabase.functions.invoke(fn, { body: { niche: niche.trim(), location: location.trim() || null } });
    let code: string | null = data?.error ?? null;
    if (error) { code = "errGeneric"; try { const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); code = body?.error ?? code; } catch { /* ignore */ } }
    if (code) {
      setErr(code === "missing_api_key" ? D.errKey : code === "limit_reached" ? D.errLimit : code === "places_error" || code === "cse_error" ? D.errPlaces : D.errGeneric);
      // Mesmo bloqueada (cota/erro), recarrega histórico e cota — o estado pode ter mudado.
      await Promise.all([loadRecent(), refresh()]);
      return;
    }
    setResult({ inserted: data.inserted ?? 0, skipped: data.skipped ?? 0, found: data.found ?? 0, preview: data.preview ?? [] });
    await Promise.all([loadRecent(), refresh()]);
  }

  // Deriva city/region/country do label da cidade selecionada ("Biguaçu, Santa Catarina, Brasil").
  // region/country são best-effort (o bbox é o filtro real); country vira ISO quando reconhecido.
  function deriveCityParts(sel: CitySelection) {
    const parts = sel.label.split(",").map((s) => s.trim()).filter(Boolean);
    const city = parts[0] || location.trim();
    const region = parts.length >= 3 ? parts[1] : undefined;
    const rawCountry = parts[parts.length - 1] || "";
    const country = /bra[sz]il/i.test(rawCountry) ? "BR" : (rawCountry || undefined);
    return { city, region, country };
  }

  // Nova fonte: Overture Maps (grátis, com cache). A v2 salva os leads na tabela
  // `leads` e responde no MESMO formato da extract-google-maps (inserted/skipped/
  // found/source/cap/used/preview). Retornos:
  //   "ok"       -> trouxe resultados, UI já atualizada (não cai pro Google)
  //   "handled"  -> cota estourada (402): erro já exibido, NÃO cair pro Google
  //   "fallback" -> zero resultados ou erro não-cota: cair pro Google Places
  async function runOverture(sel: CitySelection): Promise<"ok" | "handled" | "fallback"> {
    const { city, region, country } = deriveCityParts(sel);
    const { data, error } = await supabase.functions.invoke("search-overture", { body: { niche: niche.trim(), bbox: sel.bbox, city, region, country } });

    // Extrai o código de erro (mesma leitura de context que o Google usa).
    let code: string | null = data?.error ?? null;
    if (error) { code = "errGeneric"; try { const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); code = body?.error ?? code; } catch { /* ignore */ } }

    // Cota estourada: mostra o MESMO aviso do Google e NÃO cai pro Google (senão fura a cota).
    if (code === "limit_reached") {
      setErr(D.errLimit);
      await Promise.all([loadRecent(), refresh()]);
      return "handled";
    }
    // Qualquer outro erro (overture_failed, insert_failed, unexpected…): cai pro Google pra não travar o usuário.
    if (code) { console.warn("[maisLEAD] search-overture erro — fallback Google Places:", code); return "fallback"; }

    const found: number = data?.found ?? 0;
    console.log(`[maisLEAD] Overture source=${data?.source ?? "?"} inserted=${data?.inserted ?? 0} skipped=${data?.skipped ?? 0} found=${found}`);
    // Sem cobertura no Overture pra essa cidade+nicho: cai pro Google.
    if (found === 0) return "fallback";

    // Resposta idêntica ao Google → mesmo tratamento: contadores + preview prontos + reload.
    setResult({ inserted: data.inserted ?? 0, skipped: data.skipped ?? 0, found, preview: data.preview ?? [] });
    await Promise.all([loadRecent(), refresh()]);
    return "ok";
  }

  async function run() {
    setErr(null); setResult(null);
    if (!niche.trim()) { setErr(D.reqNiche); return; }
    setBusy(true);
    try {
      // Overture primeiro: só no Google Places e quando há bbox da cidade selecionada.
      if (source === "google_maps" && citySelection?.bbox) {
        const outcome = await runOverture(citySelection);
        if (outcome === "fallback") await runGooglePlaces();
        // "ok" e "handled" encerram aqui (resultado ou aviso de cota já exibidos).
      } else {
        // Sem bbox (cidade digitada mas não selecionada) ou modo websites: fluxo atual.
        await runGooglePlaces();
      }
    } catch { setErr(D.errGeneric); }
    finally { setBusy(false); }
  }

  const RECEIVE: [IconName, string][] = [["database", D.f_company], ["phone", D.f_phone], ["mail", D.f_email], ["globe", D.f_site], ["mapPin", D.f_addr], ["award", D.f_rating]];

  return (
    <div className="ml-fade" style={{ maxWidth: 900, margin: "8px auto 0", display: "flex", flexDirection: "column", gap: 22 }}>
      {/* card de busca */}
      <Panel style={{ padding: 32, borderRadius: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: 15, background: source === "google_maps" ? "rgba(76,46,224,.12)" : "rgba(16,185,129,.14)", color: source === "google_maps" ? "var(--ml-primary)" : "var(--ml-green)", display: "grid", placeItems: "center" }}><Icon name={source === "google_maps" ? "mapPin" : "globe"} size={24} /></div>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800 }}>{title}</div>
            <div style={{ fontSize: 13.5, color: "var(--ml-muted)" }}>{sub}</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={lbl}>{D.niche}</label>
            <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder={D.nichePh} style={inp} onKeyDown={(e) => e.key === "Enter" && run()} />
          </div>
          <CityAutocomplete
            value={location}
            onTextChange={(t) => { setLocation(t); if (citySelection) setCitySelection(null); }}
            onSelect={(sel) => { setCitySelection(sel); setLocation(sel.label); }}
            label={D.location}
            placeholder={D.locPh}
            labelStyle={lbl}
            inputStyle={inp}
            onEnter={run}
          />
        </div>

        <button onClick={run} disabled={busy} style={{ width: "100%", height: 50, marginTop: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 13, border: "none", background: "linear-gradient(135deg,#4c2ee0,#6d4bff)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, boxShadow: "0 10px 24px rgba(76,46,224,.32)" }}>
          {busy ? <Icon name="loader" size={17} className="ml-spin" /> : <Icon name="search" size={17} />}{busy ? D.searching : D.search}
        </button>

        {/* cota do mês — visível antes de buscar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 12.5, color: remaining > 0 ? "var(--ml-muted)" : "var(--ml-red)" }}>
          <Icon name="database" size={14} />
          <span>{remaining > 0 ? D.quotaPre(remaining, cap) : D.quotaOut}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--ml-primary)", background: "rgba(76,46,224,.1)", padding: "2px 9px", borderRadius: 20 }}>{planName}</span>
        </div>
        <div style={{ height: 5, borderRadius: 5, background: "var(--ml-grid)", overflow: "hidden", marginTop: 7 }}>
          <div style={{ width: `${cap > 0 ? Math.min(100, (used / cap) * 100) : 0}%`, height: "100%", background: remaining > 0 ? "var(--ml-primary)" : "var(--ml-red)", transition: "width .3s ease" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "12px 14px", borderRadius: 11, background: "var(--ml-grid)", fontSize: 13, color: "var(--ml-muted)" }}>
          <Icon name="timer" size={16} />{D.info}
        </div>
        {err && <div style={{ marginTop: 14, fontSize: 13.5, color: "var(--ml-red)", background: "rgba(239,68,68,.1)", padding: "11px 13px", borderRadius: 10, lineHeight: 1.5 }}>{err}</div>}
      </Panel>

      {/* chips */}
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ml-muted)", marginBottom: 10 }}>{D.popular}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {POPULAR.map((p) => (
            <button key={p} onClick={() => setNiche(p)} style={chip(niche === p)}><Icon name={POPULAR_ICONS[p] ?? "database"} size={14} />{p}</button>
          ))}
        </div>
      </div>

      {/* resultado */}
      {result && (
        <Panel>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(16,185,129,.14)", display: "grid", placeItems: "center", color: "var(--ml-green)" }}><Icon name="check" size={17} /></div>
            <div style={{ fontWeight: 700 }}>{D.okTitle}</div>
          </div>
          <div style={{ display: "flex", gap: 18, fontSize: 13.5, marginBottom: result.preview.length ? 14 : 0 }}>
            <span><b style={{ color: "var(--ml-green)", fontSize: 18 }}>{result.inserted}</b> {D.inserted}</span>
            <span style={{ color: "var(--ml-muted)" }}><b>{result.skipped}</b> {D.skipped}</span>
            <span style={{ color: "var(--ml-muted)" }}><b>{result.found}</b> {D.found}</span>
          </div>
          {result.preview.length > 0 && (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ml-muted)", marginBottom: 8 }}>{result.preview.length} {D.found} · {D.clickDetail}</div>
              <div className="ml-scroll" style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto" }}>
                {result.preview.map((p, i) => (
                  <button key={i} onClick={() => openDetail(p)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 11px", borderRadius: 9, background: "var(--ml-grid)", fontSize: 13, border: "1px solid transparent", cursor: "pointer", textAlign: "left", width: "100%" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--ml-primary)")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}>
                    <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ml-text)" }}>{p.company_name}</span>
                    <span style={{ color: "var(--ml-muted)", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{p.phone || p.email || p.website || "—"} · <b style={{ color: "var(--ml-primary)" }}>{p.score}</b></span>
                      {detailBusy === p.company_name ? <Icon name="loader" size={13} className="ml-spin" /> : <span style={{ color: "var(--ml-primary)", fontWeight: 700 }}>→</span>}
                    </span>
                  </button>
                ))}
              </div>
              {onGoLeads && <button onClick={onGoLeads} style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-primary)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}><Icon name="users" size={15} />{D.goLeads}</button>}
            </>
          )}
        </Panel>
      )}

      {/* recentes + o que você recebe */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Panel>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, marginBottom: 14 }}><Icon name="timer" size={16} />{D.recent}</div>
          {recent.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--ml-muted)" }}>{D.noRecent}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {recent.map((s) => (
                <button key={s.id} onClick={() => { setNiche(s.query); setLocation(s.location ?? ""); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "9px 11px", borderRadius: 10, border: "1px solid var(--ml-border)", background: "var(--ml-card)", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.query}</div>
                    {s.location && <div style={{ fontSize: 11.5, color: "var(--ml-muted)" }}>{s.location}</div>}
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: "var(--ml-primary)", background: "rgba(76,46,224,.12)", padding: "3px 9px", borderRadius: 20 }}>{s.count} leads</span>
                </button>
              ))}
            </div>
          )}
        </Panel>

        <Panel style={{ background: "var(--ml-grid)" }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>{D.receive}</div>
          <div style={{ fontSize: 12.5, color: "var(--ml-muted)", marginBottom: 14 }}>{D.receiveSub}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {RECEIVE.map(([icon, label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13 }}>
                <span style={{ color: "var(--ml-primary)", display: "grid", placeItems: "center" }}><Icon name={icon} size={16} /></span>{label}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <LeadDrawer lead={detailLead} onClose={() => setDetailLead(null)} onChanged={() => { /* preview não muda */ }} />
    </div>
  );
}

const lbl: CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ml-navtext)", marginBottom: 7 };
const inp: CSSProperties = { width: "100%", height: 48, padding: "0 14px", borderRadius: 12, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", fontSize: 14, outline: "none" };
const chip = (on: boolean): CSSProperties => ({ display: "flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 20, border: `1px solid ${on ? "var(--ml-primary)" : "var(--ml-border)"}`, background: on ? "rgba(76,46,224,.06)" : "var(--ml-card)", color: on ? "var(--ml-primary)" : "var(--ml-text)", fontSize: 13, fontWeight: 600, cursor: "pointer" });
