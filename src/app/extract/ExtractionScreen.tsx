import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "../LangTheme";
import { useAuth } from "../AuthContext";
import { Icon, type IconName } from "../icons";
import { LeadDrawer } from "../leads/LeadDrawer";
import { mapLead, type LeadRow, type DbLead } from "../leads/model";
import { CityAutocomplete, type CitySelection } from "./CityAutocomplete";
import { usePlan } from "../plan";
import { CenterModal } from "../CenterModal";

const Panel = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 18, padding: 20, boxShadow: "0 1px 3px rgba(30,25,60,.04)", ...style }}>{children}</div>
);

type Source = "google_maps" | "website";

const DICT = {
  pt: {
    gTitle: "Buscar em Google Places", gSub: "Encontre empresas por nicho e localização no Google Maps",
    wTitle: "Buscar em Websites", wSub: "Rastreie websites por nicho e localização",
    niche: "Nicho de Atuação", nichePh: "Ex: Restaurantes, Academias...", location: "Localização", locPh: "Ex: São Paulo, SP",
    search: "Buscar", searching: "Buscando…",
    freeInfo: "Buscar é grátis e ilimitado. Você só usa cota ao revelar os contatos dos leads que escolher.",
    info: "A busca retorna nome, telefone, endereço e website públicos das empresas encontradas.",
    selectCity: "Selecione uma cidade nas sugestões para buscar (grátis e ilimitado).",
    quotaPre: (r: number, c: number) => `Você tem ${r.toLocaleString("pt-BR")} de ${c.toLocaleString("pt-BR")} leads disponíveis este mês`,
    quotaUnlimited: "Cota ilimitada", quotaOut: "Você atingiu o limite de leads deste mês",
    popular: "Nichos populares", recent: "Buscas recentes", noRecent: "Nenhuma busca ainda.",
    receive: "O que você recebe", receiveSub: "Cada resultado traz os dados públicos da empresa.",
    reqNiche: "Informe um nicho para buscar.",
    // resultados da busca (mascarados)
    foundTitle: (n: number) => `${n.toLocaleString("pt-BR")} ${n === 1 ? "empresa encontrada" : "empresas encontradas"}`,
    foundSub: "Marque quem você quer e revele os contatos. Só os revelados usam cota.",
    owned: "na sua base", tagSite: "site", tagPhone: "telefone", noContact: "sem contato público",
    reveal: "Revelar selecionados", revealCost: (n: number) => `usa ${n} ${n === 1 ? "lead" : "leads"} da cota`,
    revealing: "Revelando…",
    confirmReveal: (n: number) => `Revelar ${n} ${n === 1 ? "lead vai usar 1 lead" : `leads vai usar ${n} leads`} do seu limite mensal. Continuar?`,
    revealTitle: "Revelar contatos", confirm: "Confirmar", cancel: "Cancelar", dontAskAgain: "Não mostrar esta mensagem novamente",
    revealedMsg: (r: number) => `${r} ${r === 1 ? "lead revelado" : "leads revelados"} e adicionados à sua base`,
    ownedMsg: (n: number) => `${n} já estavam na sua base`,
    skipMsg: (n: number) => `${n} ignorados (duplicados)`,
    notRevealedMsg: (n: number) => `${n} não couberam na cota — faça upgrade para revelar o resto`,
    quotaZeroReveal: "Cota do mês esgotada. Faça upgrade para revelar mais leads.",
    goLeads: "Ver na lista de Leads",
    // google opt-in
    googleTitle: "Nada encontrado nesta região pelo Overture",
    googleSub: "Podemos buscar no Google Places — mas o Google importa tudo de uma vez e consome sua cota (sem seleção).",
    googleBtn: "Buscar no Google (consome cota)",
    // google import result (fluxo antigo)
    okTitle: "Extração concluída", inserted: "novos leads", skipped: "duplicados ignorados", found: "encontrados", clickDetail: "clique para ver detalhes",
    errKey: "A chave de API desta extração ainda não foi configurada no servidor. Assim que você enviar a chave, esta tela passa a extrair de verdade.",
    errLimit: "Limite de leads do seu plano foi atingido este mês. Faça upgrade para continuar.",
    errPlaces: "O provedor de busca recusou a requisição (verifique a chave/faturamento).", errGeneric: "Não foi possível concluir a busca agora.",
    f_company: "Nome da empresa", f_phone: "Telefone", f_email: "E-mail", f_site: "Website", f_addr: "Endereço", f_rating: "Avaliações",
  },
  en: {
    gTitle: "Search Google Places", gSub: "Find businesses by niche and location on Google Maps",
    wTitle: "Search Websites", wSub: "Crawl websites by niche and location",
    niche: "Niche", nichePh: "E.g.: Restaurants, Gyms...", location: "Location", locPh: "E.g.: New York, NY",
    search: "Search", searching: "Searching…",
    freeInfo: "Searching is free and unlimited. You only spend quota when you reveal the contacts of the leads you pick.",
    info: "The search returns public name, phone, address and website of the businesses found.",
    selectCity: "Pick a city from the suggestions to search (free and unlimited).",
    quotaPre: (r: number, c: number) => `You have ${r.toLocaleString("en-US")} of ${c.toLocaleString("en-US")} leads available this month`,
    quotaUnlimited: "Unlimited quota", quotaOut: "You've reached this month's lead limit",
    popular: "Popular niches", recent: "Recent searches", noRecent: "No searches yet.",
    receive: "What you get", receiveSub: "Each result brings the company's public data.",
    reqNiche: "Enter a niche to search.",
    foundTitle: (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "business found" : "businesses found"}`,
    foundSub: "Check the ones you want and reveal the contacts. Only revealed leads use quota.",
    owned: "in your base", tagSite: "website", tagPhone: "phone", noContact: "no public contact",
    reveal: "Reveal selected", revealCost: (n: number) => `uses ${n} ${n === 1 ? "lead" : "leads"} from quota`,
    revealing: "Revealing…",
    confirmReveal: (n: number) => `Revealing ${n} ${n === 1 ? "lead will use 1 lead" : `leads will use ${n} leads`} of your monthly limit. Continue?`,
    revealTitle: "Reveal contacts", confirm: "Confirm", cancel: "Cancel", dontAskAgain: "Don't show this message again",
    revealedMsg: (r: number) => `${r} ${r === 1 ? "lead revealed" : "leads revealed"} and added to your base`,
    ownedMsg: (n: number) => `${n} were already in your base`,
    skipMsg: (n: number) => `${n} skipped (duplicates)`,
    notRevealedMsg: (n: number) => `${n} didn't fit your quota — upgrade to reveal the rest`,
    quotaZeroReveal: "Monthly quota exhausted. Upgrade to reveal more leads.",
    goLeads: "View in Leads list",
    googleTitle: "Nothing found in this area via Overture",
    googleSub: "We can search Google Places — but Google imports everything at once and consumes your quota (no selection).",
    googleBtn: "Search Google (uses quota)",
    okTitle: "Extraction complete", inserted: "new leads", skipped: "duplicates skipped", found: "found", clickDetail: "click to view details",
    errKey: "This extraction's API key isn't configured on the server yet. As soon as you send the key, this screen extracts for real.",
    errLimit: "Your plan's monthly lead limit was reached. Upgrade to keep going.",
    errPlaces: "The search provider rejected the request (check key/billing).", errGeneric: "Couldn't complete the search right now.",
    f_company: "Company name", f_phone: "Phone", f_email: "Email", f_site: "Website", f_addr: "Address", f_rating: "Ratings",
  },
  es: {
    gTitle: "Buscar en Google Places", gSub: "Encuentra empresas por nicho y ubicación en Google Maps",
    wTitle: "Buscar en Sitios Web", wSub: "Rastrea sitios web por nicho y ubicación",
    niche: "Nicho", nichePh: "Ej: Restaurantes, Gimnasios...", location: "Ubicación", locPh: "Ej: Madrid",
    search: "Buscar", searching: "Buscando…",
    freeInfo: "Buscar es gratis e ilimitado. Solo usas cuota al revelar los contactos de los leads que elijas.",
    info: "La búsqueda devuelve nombre, teléfono, dirección y web públicos de las empresas encontradas.",
    selectCity: "Selecciona una ciudad de las sugerencias para buscar (gratis e ilimitado).",
    quotaPre: (r: number, c: number) => `Tienes ${r.toLocaleString("es-ES")} de ${c.toLocaleString("es-ES")} leads disponibles este mes`,
    quotaUnlimited: "Cuota ilimitada", quotaOut: "Alcanzaste el límite de leads de este mes",
    popular: "Nichos populares", recent: "Búsquedas recientes", noRecent: "Aún no hay búsquedas.",
    receive: "Lo que recibes", receiveSub: "Cada resultado trae los datos públicos de la empresa.",
    reqNiche: "Ingresa un nicho para buscar.",
    foundTitle: (n: number) => `${n.toLocaleString("es-ES")} ${n === 1 ? "empresa encontrada" : "empresas encontradas"}`,
    foundSub: "Marca las que quieras y revela los contactos. Solo los revelados usan cuota.",
    owned: "en tu base", tagSite: "sitio", tagPhone: "teléfono", noContact: "sin contacto público",
    reveal: "Revelar seleccionados", revealCost: (n: number) => `usa ${n} ${n === 1 ? "lead" : "leads"} de la cuota`,
    revealing: "Revelando…",
    confirmReveal: (n: number) => `Revelar ${n} ${n === 1 ? "lead usará 1 lead" : `leads usará ${n} leads`} de tu límite mensual. ¿Continuar?`,
    revealTitle: "Revelar contactos", confirm: "Confirmar", cancel: "Cancelar", dontAskAgain: "No mostrar este mensaje de nuevo",
    revealedMsg: (r: number) => `${r} ${r === 1 ? "lead revelado" : "leads revelados"} y agregados a tu base`,
    ownedMsg: (n: number) => `${n} ya estaban en tu base`,
    skipMsg: (n: number) => `${n} omitidos (duplicados)`,
    notRevealedMsg: (n: number) => `${n} no cupieron en tu cuota — mejora tu plan para revelar el resto`,
    quotaZeroReveal: "Cuota mensual agotada. Mejora tu plan para revelar más leads.",
    goLeads: "Ver en la lista de Leads",
    googleTitle: "Nada encontrado en esta zona por Overture",
    googleSub: "Podemos buscar en Google Places — pero Google importa todo de una vez y consume tu cuota (sin selección).",
    googleBtn: "Buscar en Google (usa cuota)",
    okTitle: "Extracción completa", inserted: "nuevos leads", skipped: "duplicados omitidos", found: "encontrados", clickDetail: "haz clic para ver detalles",
    errKey: "La clave de API de esta extracción aún no está configurada en el servidor. En cuanto envíes la clave, esta pantalla extrae de verdad.",
    errLimit: "Se alcanzó el límite mensual de leads de tu plan. Mejora tu plan para seguir.",
    errPlaces: "El proveedor de búsqueda rechazó la solicitud (revisa clave/facturación).", errGeneric: "No se pudo completar la búsqueda ahora.",
    f_company: "Nombre de empresa", f_phone: "Teléfono", f_email: "Email", f_site: "Sitio web", f_addr: "Dirección", f_rating: "Reseñas",
  },
};

const POPULAR = ["Restaurantes", "Academias", "Clínicas", "Madeireiras", "Reformas", "Pisos", "Advocacia", "Estética"];
const POPULAR_ICONS: Record<string, IconName> = { Restaurantes: "database", Academias: "award", Clínicas: "plus", Madeireiras: "database", Reformas: "settings", Pisos: "dashboard", Advocacia: "award", Estética: "spark" };

interface SearchRow { id: string; query: string; location: string | null; count: number; created_at: string; }
interface Preview { company_name: string; phone?: string | null; website?: string | null; email?: string | null; score: number; }

// Resultado mascarado da action "search" (Overture). Campos completos (phone/website)
// só vêm quando already_owned=true; senão, só as versões mascaradas.
interface SearchResult {
  base_lead_id: string;
  company_name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  has_phone: boolean;
  has_website: boolean;
  phone_masked: string | null;
  website_masked: string | null;
  already_owned: boolean;
  phone?: string | null;
  website?: string | null;
  // preenchidos localmente após revelar
  revealed?: boolean;
  score?: number | null;
}
interface Quota { cap: number | null; used: number; remaining: number | null }

export function ExtractionScreen({ source, fn, onGoLeads }: { source: Source; fn: string; onGoLeads?: () => void }) {
  const { lang } = useLang();
  const { refresh } = useAuth();
  const auth = useAuth();
  const D = DICT[lang];
  const plan = usePlan();
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [citySelection, setCitySelection] = useState<CitySelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<SearchRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // ---- estado da busca mascarada (Overture) ----
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [quota, setQuota] = useState<Quota | null>(null);
  const [revealBusy, setRevealBusy] = useState(false);
  const [revealMsg, setRevealMsg] = useState<string[] | null>(null);
  const [showGoogleOptIn, setShowGoogleOptIn] = useState(false);
  // Modal de confirmação do reveal (substitui o window.confirm nativo).
  // A preferência "não perguntar de novo" fica no perfil (profiles.hide_reveal_confirm),
  // então vale em qualquer dispositivo — nada de localStorage.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dontAsk, setDontAsk] = useState(false);
  const [savingPref, setSavingPref] = useState(false);

  // ---- resultado do import-all do Google (fluxo antigo, opt-in) ----
  const [googleResult, setGoogleResult] = useState<{ inserted: number; skipped: number; found: number; preview: Preview[] } | null>(null);

  const [detailLead, setDetailLead] = useState<LeadRow | null>(null);
  const [detailBusy, setDetailBusy] = useState<string | null>(null);

  // cota exibida: prioriza a última resposta do servidor (mais viva que o snapshot da conta)
  const dispCap = quota ? quota.cap : (plan.cap ?? null);
  const dispUsed = quota ? quota.used : plan.used;
  const dispRemaining = quota ? quota.remaining : plan.remaining;
  const unlimited = dispCap === null || dispRemaining === null;
  const remainingN = dispRemaining ?? Infinity;

  async function openDetail(companyName: string, phone?: string | null) {
    const acc = auth.account?.id;
    if (!acc || detailBusy) return;
    setDetailBusy(companyName);
    try {
      let qb = supabase.from("leads").select("*").eq("account_id", acc).eq("company_name", companyName).order("created_at", { ascending: false }).limit(1);
      if (phone) qb = qb.eq("phone", phone);
      const { data } = await qb;
      if (data && data[0]) setDetailLead(mapLead(data[0] as DbLead));
    } finally { setDetailBusy(null); }
  }

  const title = source === "google_maps" ? D.gTitle : D.wTitle;
  const sub = source === "google_maps" ? D.gSub : D.wSub;
  const recentSources = source === "google_maps" ? ["google_maps", "overture"] : [source];

  async function loadRecent() {
    const acc = auth.account?.id;
    if (!acc) return;
    const { data } = await supabase.from("searches").select("id, query, location, count, created_at").eq("account_id", acc).in("source", recentSources).order("created_at", { ascending: false }).limit(6);
    setRecent((data as SearchRow[]) ?? []);
  }
  useEffect(() => { loadRecent(); /* eslint-disable-next-line */ }, [auth.account?.id, source]);

  function deriveCityParts(sel: CitySelection) {
    const parts = sel.label.split(",").map((s) => s.trim()).filter(Boolean);
    const city = parts[0] || location.trim();
    const region = parts.length >= 3 ? parts[1] : undefined;
    const rawCountry = parts[parts.length - 1] || "";
    const country = /bra[sz]il/i.test(rawCountry) ? "BR" : (rawCountry || undefined);
    return { city, region, country };
  }

  function readErr(data: unknown, error: unknown): string | null {
    let code: string | null = (data as { error?: string } | null)?.error ?? null;
    if (error) { code = "errGeneric"; }
    return code;
  }

  // ---- BUSCA grátis (action "search") ----
  async function doSearch(sel: CitySelection) {
    const { city, region, country } = deriveCityParts(sel);
    const { data, error } = await supabase.functions.invoke("search-overture", { body: { action: "search", niche: niche.trim(), bbox: sel.bbox, city, region, country } });
    if (error || data?.error) {
      // buscar não deveria falhar; se falhar, oferece o Google como saída
      console.warn("[maisLEAD] search falhou:", data?.error ?? error);
      setShowGoogleOptIn(true);
      setResults([]);
      return;
    }
    const found: number = data?.found ?? 0;
    console.log(`[maisLEAD] search source=${data?.source ?? "?"} found=${found}`);
    setQuota(data?.quota ?? null);
    setResults(data?.results ?? []);
    setSelected(new Set());
    setRevealMsg(null);
    setShowGoogleOptIn(found === 0); // sem cobertura → oferece Google opt-in
    await loadRecent();
  }

  // ---- REVELAR selecionados ----
  // Fluxo: requestReveal() decide se abre o modal ou revela direto (preferência do perfil);
  // onConfirmReveal() grava a preferência se marcada e dispara performReveal();
  // performReveal() faz a chamada que consome cota.
  function requestReveal() {
    if (!results || selected.size === 0 || revealBusy) return;
    if (auth.profile?.hide_reveal_confirm) { performReveal(); return; }
    setDontAsk(false);
    setConfirmOpen(true);
  }

  async function onConfirmReveal() {
    // Grava a preferência antes de fechar/revelar. Best-effort: se falhar, o reveal segue.
    if (dontAsk && auth.profile?.id) {
      setSavingPref(true);
      try {
        await supabase.from("profiles").update({ hide_reveal_confirm: true }).eq("id", auth.profile.id);
        await refresh();
      } catch { /* preferência é best-effort; não bloqueia o reveal */ }
      finally { setSavingPref(false); }
    }
    setConfirmOpen(false);
    await performReveal();
  }

  async function performReveal() {
    if (!results || selected.size === 0 || revealBusy) return;
    const ids = [...selected];
    setRevealBusy(true); setErr(null);
    try {
      const city = citySelection ? deriveCityParts(citySelection).city : location.trim() || null;
      const { data, error } = await supabase.functions.invoke("search-overture", { body: { action: "reveal", base_lead_ids: ids, niche: niche.trim(), city } });
      let code = readErr(data, error);
      if (error) { try { const b = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); code = b?.error ?? code; } catch { /* ignore */ } }
      if (code === "limit_reached") { setErr(D.quotaZeroReveal); await refresh(); return; }
      if (code) { setErr(D.errGeneric); return; }

      // aplica os dados completos nas linhas reveladas
      const byId = new Map<string, { phone: string | null; website: string | null; score: number | null }>();
      for (const l of (data.leads ?? [])) byId.set(l.base_lead_id, { phone: l.phone ?? null, website: l.website ?? null, score: l.score ?? null });
      setResults((prev) => prev?.map((r) => {
        const full = byId.get(r.base_lead_id);
        if (!full) return r;
        return { ...r, revealed: true, already_owned: true, phone: full.phone, website: full.website, score: full.score };
      }) ?? prev);
      setSelected(new Set());
      if (data.quota) setQuota(data.quota);

      const msgs: string[] = [];
      if (data.revealed) msgs.push(D.revealedMsg(data.revealed));
      if (data.already_owned) msgs.push(D.ownedMsg(data.already_owned));
      if (data.skipped_duplicate) msgs.push(D.skipMsg(data.skipped_duplicate));
      if (data.not_revealed) msgs.push(D.notRevealedMsg(data.not_revealed));
      setRevealMsg(msgs);
      await Promise.all([loadRecent(), refresh()]);
    } catch { setErr(D.errGeneric); }
    finally { setRevealBusy(false); }
  }

  // ---- import-all do Google (fluxo antigo) — websites e opt-in explícito ----
  async function runGooglePlaces() {
    const { data, error } = await supabase.functions.invoke(fn, { body: { niche: niche.trim(), location: location.trim() || null } });
    let code: string | null = data?.error ?? null;
    if (error) { code = "errGeneric"; try { const body = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); code = body?.error ?? code; } catch { /* ignore */ } }
    if (code) {
      setErr(code === "missing_api_key" ? D.errKey : code === "limit_reached" ? D.errLimit : code === "places_error" || code === "cse_error" ? D.errPlaces : D.errGeneric);
      await Promise.all([loadRecent(), refresh()]);
      return;
    }
    setGoogleResult({ inserted: data.inserted ?? 0, skipped: data.skipped ?? 0, found: data.found ?? 0, preview: data.preview ?? [] });
    setShowGoogleOptIn(false);
    await Promise.all([loadRecent(), refresh()]);
  }

  // botão "Buscar"
  async function run() {
    setErr(null); setResults(null); setGoogleResult(null); setShowGoogleOptIn(false); setRevealMsg(null); setQuota(null);
    if (!niche.trim()) { setErr(D.reqNiche); return; }
    setBusy(true);
    try {
      if (source === "website") {
        await runGooglePlaces(); // websites continua importando tudo (inalterado)
      } else if (citySelection?.bbox) {
        await doSearch(citySelection); // Google Places = busca grátis mascarada
      } else {
        setErr(D.selectCity); // sem cidade selecionada não há bbox pro Overture
      }
    } catch { setErr(D.errGeneric); }
    finally { setBusy(false); }
  }

  // botão opt-in do Google (importa tudo e consome cota)
  async function runGoogleOptIn() {
    setBusy(true); setErr(null);
    try { await runGooglePlaces(); } catch { setErr(D.errGeneric); }
    finally { setBusy(false); }
  }

  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const RECEIVE: [IconName, string][] = [["database", D.f_company], ["phone", D.f_phone], ["mail", D.f_email], ["globe", D.f_site], ["mapPin", D.f_addr], ["award", D.f_rating]];
  const selCount = selected.size;

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

        {/* cota do mês */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 12.5, color: remainingN > 0 ? "var(--ml-muted)" : "var(--ml-red)" }}>
          <Icon name="database" size={14} />
          <span>{unlimited ? D.quotaUnlimited : remainingN > 0 ? D.quotaPre(remainingN, dispCap as number) : D.quotaOut}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: "var(--ml-primary)", background: "rgba(76,46,224,.1)", padding: "2px 9px", borderRadius: 20 }}>{plan.label}</span>
        </div>
        {!unlimited && (
          <div style={{ height: 5, borderRadius: 5, background: "var(--ml-grid)", overflow: "hidden", marginTop: 7 }}>
            <div style={{ width: `${(dispCap as number) > 0 ? Math.min(100, (dispUsed / (dispCap as number)) * 100) : 0}%`, height: "100%", background: remainingN > 0 ? "var(--ml-primary)" : "var(--ml-red)", transition: "width .3s ease" }} />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, padding: "12px 14px", borderRadius: 11, background: "var(--ml-grid)", fontSize: 13, color: "var(--ml-muted)" }}>
          <Icon name="timer" size={16} />{source === "google_maps" ? D.freeInfo : D.info}
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

      {/* ===== resultados mascarados (Overture) ===== */}
      {results && results.length > 0 && (
        <Panel>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{D.foundTitle(results.length)}</div>
              <div style={{ fontSize: 12.5, color: "var(--ml-muted)", marginTop: 2 }}>{D.foundSub}</div>
            </div>
          </div>

          {revealMsg && revealMsg.length > 0 && (
            <div style={{ margin: "10px 0 4px", padding: "10px 13px", borderRadius: 10, background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.28)", fontSize: 12.5, color: "var(--ml-text)", display: "flex", flexDirection: "column", gap: 3 }}>
              {revealMsg.map((m, i) => <span key={i}>{i === 0 ? "✓ " : "· "}{m}</span>)}
            </div>
          )}

          <div className="ml-scroll" style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 440, overflowY: "auto", marginTop: 12 }}>
            {results.map((r) => {
              const owned = r.already_owned; // já na base (ou acabou de revelar)
              const on = selected.has(r.base_lead_id);
              const phoneText = owned ? (r.phone || "—") : (r.phone_masked || (r.has_phone ? "•••" : null));
              const siteText = owned ? (r.website || null) : (r.website_masked || (r.has_website ? "•••" : null));
              return (
                <div key={r.base_lead_id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 10, background: "var(--ml-grid)", fontSize: 13, border: `1px solid ${on ? "var(--ml-primary)" : "transparent"}` }}>
                  <input type="checkbox" checked={on} disabled={owned} onChange={() => toggle(r.base_lead_id)}
                    style={{ width: 16, height: 16, accentColor: "#4c2ee0", cursor: owned ? "default" : "pointer", flexShrink: 0, opacity: owned ? 0.4 : 1 }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <button onClick={() => owned && openDetail(r.company_name, r.phone)} style={{ all: "unset", cursor: owned ? "pointer" : "default", fontWeight: 700, color: "var(--ml-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>{r.company_name}</button>
                      {owned && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--ml-green)", background: "rgba(16,185,129,.14)", padding: "1px 7px", borderRadius: 20 }}>{D.owned}</span>}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ml-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {r.category && <span>{r.category}</span>}
                      {r.city && <span>· {r.city}</span>}
                      {!r.has_phone && !r.has_website && <span>· {D.noContact}</span>}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right", color: "var(--ml-muted)", fontSize: 12 }}>
                    {phoneText && <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end" }}><Icon name="phone" size={12} />{owned ? <span style={{ color: "var(--ml-text)", fontWeight: 600 }}>{phoneText}</span> : <span style={{ letterSpacing: ".02em" }}>{phoneText}</span>}</div>}
                    {siteText && <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end", marginTop: 2 }}><Icon name="globe" size={12} />{owned ? <span style={{ color: "var(--ml-text)", fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{siteText}</span> : <span>{siteText}</span>}</div>}
                    {!phoneText && !siteText && <span style={{ opacity: .5 }}>—</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* barra de ação */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, flexWrap: "wrap" }}>
            <button
              onClick={requestReveal}
              disabled={selCount === 0 || revealBusy || remainingN <= 0}
              style={{ display: "flex", alignItems: "center", gap: 9, height: 44, padding: "0 20px", borderRadius: 12, border: "none", background: selCount > 0 && remainingN > 0 ? "var(--ml-primary)" : "var(--ml-border)", color: selCount > 0 && remainingN > 0 ? "#fff" : "var(--ml-muted)", fontWeight: 700, fontSize: 14, cursor: selCount === 0 || revealBusy || remainingN <= 0 ? "default" : "pointer" }}>
              {revealBusy ? <Icon name="loader" size={16} className="ml-spin" /> : <Icon name="check" size={16} />}
              {revealBusy ? D.revealing : `${D.reveal} (${selCount})`}
            </button>
            {selCount > 0 && remainingN > 0 && <span style={{ fontSize: 12.5, color: "var(--ml-muted)" }}>{D.revealCost(selCount)}</span>}
            {remainingN <= 0 && !unlimited && <span style={{ fontSize: 12.5, color: "var(--ml-red)", fontWeight: 600 }}>{D.quotaZeroReveal}</span>}
            {onGoLeads && <button onClick={onGoLeads} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 10, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-primary)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}><Icon name="users" size={15} />{D.goLeads}</button>}
          </div>
        </Panel>
      )}

      {/* ===== nada no Overture → opt-in do Google ===== */}
      {showGoogleOptIn && source === "google_maps" && (
        <Panel style={{ border: "1px solid var(--ml-amber)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(245,158,11,.14)", display: "grid", placeItems: "center", color: "var(--ml-amber)" }}><Icon name="timer" size={17} /></div>
            <div style={{ fontWeight: 700 }}>{D.googleTitle}</div>
          </div>
          <div style={{ fontSize: 13, color: "var(--ml-muted)", marginBottom: 14, lineHeight: 1.5 }}>{D.googleSub}</div>
          <button onClick={runGoogleOptIn} disabled={busy} style={{ display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 18px", borderRadius: 12, border: "1px solid var(--ml-amber)", background: "rgba(245,158,11,.1)", color: "var(--ml-amber)", fontWeight: 700, fontSize: 13.5, cursor: busy ? "default" : "pointer" }}>
            <Icon name="search" size={15} />{D.googleBtn}
          </button>
        </Panel>
      )}

      {/* ===== resultado do import-all Google (fluxo antigo) ===== */}
      {googleResult && (
        <Panel>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(16,185,129,.14)", display: "grid", placeItems: "center", color: "var(--ml-green)" }}><Icon name="check" size={17} /></div>
            <div style={{ fontWeight: 700 }}>{D.okTitle}</div>
          </div>
          <div style={{ display: "flex", gap: 18, fontSize: 13.5, marginBottom: googleResult.preview.length ? 14 : 0 }}>
            <span><b style={{ color: "var(--ml-green)", fontSize: 18 }}>{googleResult.inserted}</b> {D.inserted}</span>
            <span style={{ color: "var(--ml-muted)" }}><b>{googleResult.skipped}</b> {D.skipped}</span>
            <span style={{ color: "var(--ml-muted)" }}><b>{googleResult.found}</b> {D.found}</span>
          </div>
          {googleResult.preview.length > 0 && (
            <>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ml-muted)", marginBottom: 8 }}>{googleResult.preview.length} {D.found} · {D.clickDetail}</div>
              <div className="ml-scroll" style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 420, overflowY: "auto" }}>
                {googleResult.preview.map((p, i) => (
                  <button key={i} onClick={() => openDetail(p.company_name, p.phone)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "9px 11px", borderRadius: 9, background: "var(--ml-grid)", fontSize: 13, border: "1px solid transparent", cursor: "pointer", textAlign: "left", width: "100%" }}
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
                  <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: "var(--ml-primary)", background: "rgba(76,46,224,.12)", padding: "3px 9px", borderRadius: 20 }}>{s.count} {D.found}</span>
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

      {/* ===== modal de confirmação do reveal ===== */}
      {confirmOpen && (
        <CenterModal onClose={() => setConfirmOpen(false)} width={440}>
          <div style={{ padding: "26px 26px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(76,46,224,.12)", color: "var(--ml-primary)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon name="check" size={22} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{D.revealTitle}</div>
            </div>

            <div style={{ fontSize: 14, color: "var(--ml-text)", lineHeight: 1.55 }}>{D.confirmReveal(selCount)}</div>

            <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 18, fontSize: 13, color: "var(--ml-muted)", cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#4c2ee0", cursor: "pointer", flexShrink: 0 }} />
              {D.dontAskAgain}
            </label>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
              <button onClick={() => setConfirmOpen(false)} disabled={savingPref}
                style={{ padding: "11px 20px", borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-navtext)", fontWeight: 600, fontSize: 14, cursor: savingPref ? "default" : "pointer" }}>
                {D.cancel}
              </button>
              <button onClick={onConfirmReveal} disabled={savingPref}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 22px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#4c2ee0,#6d4bff)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: savingPref ? "default" : "pointer", opacity: savingPref ? 0.7 : 1 }}>
                {savingPref ? <Icon name="loader" size={15} className="ml-spin" /> : <Icon name="check" size={15} />}
                {D.confirm}
              </button>
            </div>
          </div>
        </CenterModal>
      )}
    </div>
  );
}

const lbl: CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ml-navtext)", marginBottom: 7 };
const inp: CSSProperties = { width: "100%", height: 48, padding: "0 14px", borderRadius: 12, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", fontSize: 14, outline: "none" };
const chip = (on: boolean): CSSProperties => ({ display: "flex", alignItems: "center", gap: 7, padding: "8px 13px", borderRadius: 20, border: `1px solid ${on ? "var(--ml-primary)" : "var(--ml-border)"}`, background: on ? "rgba(76,46,224,.06)" : "var(--ml-card)", color: on ? "var(--ml-primary)" : "var(--ml-text)", fontSize: 13, fontWeight: 600, cursor: "pointer" });
