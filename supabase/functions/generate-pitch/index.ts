// IA de Abordagem — gera 3 mensagens hiper-personalizadas de prospecção (WhatsApp/cold-call)
// a partir dos sinais que já temos do lead (tecnologia do site, reputação no Google,
// recém-aberta na Receita, CNAE/ramo, porte, localização).
//
// Modelo: Claude Haiku 4.5 (claude-haiku-4-5). O usuário pediu "Claude 3.5 Haiku", mas esse
// modelo foi APOSENTADO pela Anthropic em fev/2026 (retorna 404). O Haiku 4.5 é o substituto
// direto — mais capaz e mais barato.
//
// Entrada (POST): { leadId }  -> busca o lead no banco (popup de Leads)
//              ou  { signals } -> sinais inline (StagingDetailModal, empresa ainda não salva)
//              + opcional { lang: "pt" | "en" | "es" }
// Saída: { ok, opcoes: [{ tipo, titulo, mensagem }], sinais: {...} }
//
// Estruturação garantida: a resposta vem por tool-use com `strict: true` (o schema é validado
// pela própria API), então `opcoes` sempre tem o formato certo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Anthropic from "npm:@anthropic-ai/sdk@0.68.0";
import { planAllows } from "../_shared/plans.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const has = (v?: string | null) => !!(v && String(v).trim() !== "" && String(v).trim() !== "—");

const MODEL = "claude-haiku-4-5";

// ---- sinais do lead --------------------------------------------------------
interface Tech {
  cms?: string | null;
  ecommerce?: string[];
  has_pixel?: boolean;
  has_analytics?: boolean;
  is_ecommerce?: boolean;
  ok?: boolean;
}
interface Signals {
  empresa: string;
  ramo: string | null;
  localizacao: string | null;
  porte: string | null;
  mei: boolean;
  temSite: boolean;
  semPixel: boolean;     // tem site mas SEM Pixel de anúncio (cliente ouro p/ tráfego pago)
  ecommerce: boolean;
  cms: string | null;
  recemAberta: boolean;  // abriu nos últimos ~30 dias
  diasAberta: number | null;
  reputacaoRuim: boolean; // nota <= 3.5 no Google
  rating: number | null;
  reviews: number | null;
  temTelefone: boolean;
  temEmail: boolean;
}

// tira o prefixo de CNPJ que a Receita cola na razão social de MEI ("67.305.103 FULANO ...")
function stripDoc(s: string): string {
  return String(s || "").replace(/^\d{2}\.?\d{3}\.?\d{3}(\/?\d{4}-?\d{2})?\s+/, "").trim();
}

// aceita "YYYY-MM-DD", "AAAAMMDD" ou ISO; devolve dias desde a abertura (ou null)
function diasDesde(dateStr?: string | null): number | null {
  if (!has(dateStr)) return null;
  let s = String(dateStr).trim();
  let d: Date | null = null;
  if (/^\d{8}$/.test(s)) {
    d = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T00:00:00Z`);
  } else {
    const t = Date.parse(s);
    if (!Number.isNaN(t)) d = new Date(t);
  }
  if (!d || Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / 86_400_000);
}

// porte/MEI a partir do texto de notas (leads de CNPJ/receita guardam isso em notes)
function porteFromNotes(notes?: string | null): { porte: string | null; mei: boolean } {
  const n = (notes || "").toLowerCase();
  const mei = /\bmei\b|microempreendedor/.test(n);
  let porte: string | null = null;
  if (/demais|grande|média|media/.test(n)) porte = "Demais";
  else if (mei || /micro/.test(n)) porte = "Micro";
  else if (/pequen/.test(n)) porte = "Pequena";
  return { porte, mei };
}

interface LeadRow {
  company_name: string;
  industry: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  opening_date: string | null;
  rating: number | null;
  user_ratings_total: number | null;
  notes: string | null;
  source: string | null;
  type: string | null;
  tech: unknown;
}

function signalsFromLead(l: LeadRow): Signals {
  const tech = (l.tech ?? null) as Tech | null;
  const temSite = has(l.website);
  const { porte, mei } = porteFromNotes(l.notes);
  const dias = diasDesde(l.opening_date);
  const rating = l.rating != null ? Number(l.rating) : null;
  return {
    empresa: stripDoc(l.company_name),
    ramo: has(l.industry) ? l.industry : null,
    localizacao: has(l.location) ? l.location : null,
    porte,
    mei,
    temSite,
    semPixel: !!(tech && tech.ok && temSite && tech.has_pixel === false),
    ecommerce: !!(tech && tech.is_ecommerce),
    cms: (tech && tech.cms) || null,
    recemAberta: dias != null && dias <= 45,
    diasAberta: dias,
    reputacaoRuim: rating != null && rating <= 3.5,
    rating,
    reviews: l.user_ratings_total ?? null,
    temTelefone: has(l.phone),
    temEmail: has(l.email),
  };
}

// sinais inline (StagingDetailModal): empresa ainda não está no banco
interface InlineSignals {
  company?: string;
  razao_social?: string;
  cnae?: string;
  uf?: string;
  municipio?: string;
  porte?: string;
  abertura?: string;
  mei?: boolean;
  email?: string;
  phone?: string;
}
function signalsFromInline(s: InlineSignals): Signals {
  const dias = diasDesde(s.abertura);
  const local = [s.municipio, s.uf].filter(Boolean).join("/") || null;
  return {
    empresa: stripDoc(s.company || s.razao_social || "Empresa"),
    ramo: has(s.cnae) ? s.cnae! : null,
    localizacao: local,
    porte: has(s.porte) ? s.porte! : (s.mei ? "Micro" : null),
    mei: !!s.mei,
    temSite: false,
    semPixel: false,
    ecommerce: false,
    cms: null,
    recemAberta: dias != null && dias <= 45,
    diasAberta: dias,
    reputacaoRuim: false,
    rating: null,
    reviews: null,
    temTelefone: has(s.phone),
    temEmail: has(s.email),
  };
}

// ---- prompt ----------------------------------------------------------------
const SYS: Record<string, string> = {
  pt: `Você é um copywriter de prospecção B2B de uma agência de marketing digital brasileira.
Escreve mensagens curtas de primeiro contato (WhatsApp ou roteiro de ligação) para captar novos clientes.

Regras:
- Português do Brasil, tom humano e direto, SEM clichê de vendedor ("espero que esteja tudo bem", "venho por meio desta").
- Personalize usando os SINAIS reais da empresa. Cite o gancho concreto (ex.: "vi que o site de vocês ainda não tem o Pixel do Meta", "reparei que vocês abriram há pouco", "notei a nota de vocês no Google").
- Cada mensagem: 2 a 4 frases, com uma pergunta ou CTA leve no fim (nunca peça a venda de cara).
- Não invente dados que não estão nos sinais. Se não houver gancho forte, foque no ramo/localização.
- Não use emojis em excesso (no máximo 1, e só se ficar natural).
- Trate a pessoa como "você" (não sabemos o nome do dono).

Gere EXATAMENTE 3 variações, uma de cada tipo:
- "direta": curtíssima e objetiva, vai direto ao ponto e ao gancho.
- "dor": foca na dor/oportunidade que o sinal revela e em como você ajuda a resolver.
- "formal": tom mais profissional e institucional, adequado para empresas maiores.

Chame a ferramenta gerar_abordagens com as 3 opções.`,
  en: `You are a B2B outbound copywriter for a Brazilian digital marketing agency. Write short first-contact messages (WhatsApp / cold-call script) in ENGLISH. Personalize with the real SIGNALS, cite the concrete hook, 2-4 sentences each, soft CTA, no salesy clichés, no invented data. Produce EXACTLY 3 variations: "direta" (direct/short), "dor" (pain/help focused), "formal" (professional). Call the gerar_abordagens tool.`,
  es: `Eres un copywriter de prospección B2B de una agencia de marketing digital brasileña. Escribe mensajes cortos de primer contacto (WhatsApp / guion de llamada) en ESPAÑOL. Personaliza con las SEÑALES reales, cita el gancho concreto, 2-4 frases, CTA suave, sin clichés, sin inventar datos. Genera EXACTAMENTE 3 variaciones: "direta" (directa/corta), "dor" (dolor/ayuda), "formal" (profesional). Llama a la herramienta gerar_abordagens.`,
};

function ganchos(s: Signals, lang: string): string {
  const L = lang === "en" ? {
    site: "has a website but NO ad Pixel (Meta/Google) installed — perfect for a paid-traffic offer",
    nosite: "has NO website found — opportunity for landing page / online presence",
    recem: (d: number | null) => `opened recently (${d ?? "a few"} days ago) on the Receita Federal — brand new, still setting up`,
    rep: (r: number | null, n: number | null) => `low Google rating (${r} stars, ${n ?? 0} reviews) — reputation at risk`,
    ecom: "runs an online store (e-commerce)",
  } : lang === "es" ? {
    site: "tiene sitio pero SIN Pixel de anuncios (Meta/Google) — perfecto para oferta de tráfico pago",
    nosite: "NO tiene sitio encontrado — oportunidad de landing / presencia online",
    recem: (d: number | null) => `abrió recién (hace ${d ?? "pocos"} días) en la Receita Federal — nueva, aún montando`,
    rep: (r: number | null, n: number | null) => `nota baja en Google (${r} estrellas, ${n ?? 0} reseñas) — reputación en riesgo`,
    ecom: "tiene tienda online (e-commerce)",
  } : {
    site: "tem site mas SEM Pixel de anúncio (Meta/Google) instalado — cliente ideal para uma oferta de tráfego pago",
    nosite: "NÃO tem site encontrado — oportunidade de landing page / presença online",
    recem: (d: number | null) => `abriu há pouco (${d ?? "poucos"} dias) na Receita Federal — empresa nova, ainda se estruturando`,
    rep: (r: number | null, n: number | null) => `nota baixa no Google (${r} estrelas, ${n ?? 0} avaliações) — reputação em risco`,
    ecom: "tem loja online (e-commerce)",
  };
  const out: string[] = [];
  if (s.semPixel) out.push(`- ${L.site}`);
  else if (!s.temSite) out.push(`- ${L.nosite}`);
  if (s.recemAberta) out.push(`- ${L.recem(s.diasAberta)}`);
  if (s.reputacaoRuim) out.push(`- ${L.rep(s.rating, s.reviews)}`);
  if (s.ecommerce) out.push(`- ${L.ecom}`);
  return out.join("\n");
}

function userPrompt(s: Signals, lang: string): string {
  const lines: string[] = [];
  lines.push(`Empresa: ${s.empresa}`);
  if (s.ramo) lines.push(`Ramo (CNAE): ${s.ramo}`);
  if (s.localizacao) lines.push(`Localização: ${s.localizacao}`);
  if (s.porte) lines.push(`Porte: ${s.porte}${s.mei ? " (MEI)" : ""}`);
  if (s.cms) lines.push(`Plataforma do site: ${s.cms}`);
  const g = ganchos(s, lang);
  const header = lang === "en" ? "SIGNALS / hooks:" : lang === "es" ? "SEÑALES / ganchos:" : "SINAIS / ganchos:";
  const none = lang === "en" ? "(no strong signal — lean on industry/location)" :
               lang === "es" ? "(sin señal fuerte — usa ramo/ubicación)" :
               "(sem gancho forte — use o ramo/localização)";
  lines.push("", header, g || none);
  return lines.join("\n");
}

// ---- handler ---------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "no_api_key", message: "Configure o secret ANTHROPIC_API_KEY no Supabase." }, 500);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const authTok = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authTok) return json({ error: "unauthorized" }, 401);
    const { data: u, error: ue } = await admin.auth.getUser(authTok);
    if (ue || !u?.user) return json({ error: "unauthorized" }, 401);
    const { data: prof } = await admin.from("profiles").select("account_id").eq("id", u.user.id).single();
    const accountId = prof?.account_id;
    if (!accountId) return json({ error: "no_account" }, 400);

    // gate: pitch de IA é exclusivo do Business (custa tokens de IA por uso)
    const { data: gAcc } = await admin.from("accounts").select("plan").eq("id", accountId).single();
    const { data: gRoles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
    const gIsAdmin = (gRoles ?? []).some((r: { role: string }) => r.role === "admin");
    if (!gIsAdmin && !planAllows(gAcc?.plan, "pitch")) return json({ error: "feature_gated", message: "O pitch de IA é exclusivo do plano Business." }, 402);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const lang = (["pt", "en", "es"].includes(String(body.lang)) ? body.lang : "pt") as string;

    let signals: Signals | null = null;
    if (body.leadId) {
      const { data: lead, error: le } = await admin
        .from("leads")
        .select("company_name, industry, location, phone, email, website, opening_date, rating, user_ratings_total, notes, source, type, tech")
        .eq("id", body.leadId)
        .eq("account_id", accountId)
        .single();
      if (le || !lead) return json({ error: "lead_not_found" }, 404);
      signals = signalsFromLead(lead as LeadRow);
    } else if (body.signals && typeof body.signals === "object") {
      signals = signalsFromInline(body.signals as InlineSignals);
    } else {
      return json({ error: "bad_request", message: "Informe leadId ou signals." }, 400);
    }

    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYS[lang] ?? SYS.pt,
      messages: [{ role: "user", content: userPrompt(signals, lang) }],
      tools: [{
        name: "gerar_abordagens",
        description: "Retorna exatamente 3 variações de mensagem de abordagem.",
        // deno-lint-ignore no-explicit-any
        strict: true as any,
        input_schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            opcoes: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  tipo: { type: "string", enum: ["direta", "dor", "formal"] },
                  titulo: { type: "string", description: "rótulo curto da variação (2-4 palavras)" },
                  mensagem: { type: "string", description: "mensagem pronta para enviar" },
                },
                required: ["tipo", "titulo", "mensagem"],
              },
            },
          },
          required: ["opcoes"],
        },
        // deno-lint-ignore no-explicit-any
      }] as any,
      tool_choice: { type: "tool", name: "gerar_abordagens" },
    });

    // deno-lint-ignore no-explicit-any
    const toolBlock = (msg.content as any[]).find((b) => b.type === "tool_use");
    const opcoes = toolBlock?.input?.opcoes;
    if (!Array.isArray(opcoes) || opcoes.length === 0) {
      return json({ error: "empty", message: "O modelo não retornou mensagens." }, 502);
    }

    // registra o evento (não bloqueia se falhar)
    if (body.leadId) {
      admin.from("lead_events").insert({
        lead_id: body.leadId,
        account_id: accountId,
        type: "pitch_generated",
        payload: { count: opcoes.length },
      }).then(() => {}, () => {});
    }

    return json({ ok: true, opcoes, sinais: signals });
  } catch (e) {
    const message = String((e as Error)?.message ?? e);
    return json({ error: "unexpected", message }, 500);
  }
});
