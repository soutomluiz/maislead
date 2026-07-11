// Detecção de tecnologia do site (CUSTO ZERO — sem API paga).
// Baixa o HTML da home (+ headers) de leads que têm website e procura assinaturas
// de CMS, page builder, e-commerce, analytics, pixels, chat e ferramentas de marketing.
// Grava em leads.tech (jsonb) com flags derivadas (has_pixel, has_analytics, is_ecommerce)
// e registra um lead_event 'tech_detected'.
// O grande valor: "tem site mas SEM Pixel do Meta" = cliente perfeito pra tráfego pago.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const has = (v?: string | null) => !!(v && String(v).trim() !== "" && String(v).trim() !== "—");

const MAX_HTML = 600_000; // limita CPU/memória do regex por página

// Baixa o HTML + alguns headers úteis (server, x-powered-by) numa única requisição.
async function fetchDoc(url: string, ms = 6000): Promise<{ html: string; headers: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; maisLEAD-bot/1.0)" } });
    if (!r.ok) return { html: "", headers: "" };
    const ct = r.headers.get("content-type") ?? "";
    if (ct && !/(text|html|xml)/i.test(ct)) return { html: "", headers: "" };
    const hdr = [
      r.headers.get("server") ?? "",
      r.headers.get("x-powered-by") ?? "",
      r.headers.get("x-generator") ?? "",
      r.headers.get("via") ?? "",
      [...r.headers.keys()].join(" "),
    ].join(" ").toLowerCase();
    const txt = await r.text();
    return { html: txt.length > MAX_HTML ? txt.slice(0, MAX_HTML) : txt, headers: hdr };
  } catch { return { html: "", headers: "" }; } finally { clearTimeout(t); }
}

// cat: cms | builder | ecommerce | analytics | pixel | chat | marketing | framework
interface Sig { key: string; label: string; cat: string; re: RegExp; hdr?: boolean }
const SIGNATURES: Sig[] = [
  // --- CMS / site builders ---
  { key: "wordpress", label: "WordPress", cat: "cms", re: /wp-content|wp-includes|wp-json|\/wp-|wordpress/i },
  { key: "wix", label: "Wix", cat: "cms", re: /wixstatic\.com|static\.wixstatic|_wix|X-Wix|wix\.com/i, hdr: true },
  { key: "squarespace", label: "Squarespace", cat: "cms", re: /squarespace\.com|static1\.squarespace|Squarespace/i },
  { key: "webflow", label: "Webflow", cat: "cms", re: /webflow\.(com|io)|wf-|data-wf-/i },
  { key: "joomla", label: "Joomla", cat: "cms", re: /joomla|\/media\/jui\/|com_content/i },
  { key: "drupal", label: "Drupal", cat: "cms", re: /drupal|\/sites\/default\/files|Drupal\.settings/i },
  { key: "google_sites", label: "Google Sites", cat: "cms", re: /sites\.google\.com|gstatic\.com\/atari/i },
  // --- Page builders (WordPress-family) ---
  { key: "elementor", label: "Elementor", cat: "builder", re: /elementor|elementor-frontend/i },
  { key: "divi", label: "Divi", cat: "builder", re: /et_pb_|divi|et-core/i },
  { key: "wpbakery", label: "WPBakery", cat: "builder", re: /js_composer|vc_row|wpbakery/i },
  // --- E-commerce ---
  { key: "shopify", label: "Shopify", cat: "ecommerce", re: /cdn\.shopify\.com|Shopify\.theme|myshopify\.com|shopify/i },
  { key: "woocommerce", label: "WooCommerce", cat: "ecommerce", re: /woocommerce|wc-ajax|wc_add_to_cart/i },
  { key: "vtex", label: "VTEX", cat: "ecommerce", re: /vteximg\.com|vtexassets|vtex\.com|\.vtex\./i },
  { key: "nuvemshop", label: "Nuvemshop", cat: "ecommerce", re: /nuvemshop|tiendanube|d2r9epyceweg5n/i },
  { key: "lojaintegrada", label: "Loja Integrada", cat: "ecommerce", re: /lojaintegrada|integrada\.com\.br/i },
  { key: "magento", label: "Magento", cat: "ecommerce", re: /magento|Mage\.|\/skin\/frontend\//i },
  { key: "wbuy", label: "WBuy", cat: "ecommerce", re: /wbuy|wbuyapp/i },
  // --- Analytics ---
  { key: "ga4", label: "Google Analytics", cat: "analytics", re: /gtag\(|googletagmanager\.com\/gtag|google-analytics\.com|ga\('create/i },
  { key: "gtm", label: "Google Tag Manager", cat: "analytics", re: /googletagmanager\.com\/gtm|GTM-[A-Z0-9]+/i },
  { key: "hotjar", label: "Hotjar", cat: "analytics", re: /hotjar\.com|hjSetting|static\.hotjar/i },
  { key: "clarity", label: "MS Clarity", cat: "analytics", re: /clarity\.ms|clarity\(/i },
  // --- Pixels de anúncio (o filtro de ouro) ---
  { key: "meta_pixel", label: "Pixel do Meta", cat: "pixel", re: /connect\.facebook\.net|fbevents\.js|fbq\(|facebook-jssdk/i },
  { key: "tiktok_pixel", label: "Pixel do TikTok", cat: "pixel", re: /analytics\.tiktok\.com|ttq\.|tiktok.*pixel/i },
  { key: "gads", label: "Google Ads", cat: "pixel", re: /googleadservices\.com|google_conversion|aw-\d|gtag\/js\?id=AW-/i },
  { key: "linkedin_pixel", label: "LinkedIn Insight", cat: "pixel", re: /snap\.licdn\.com|_linkedin_partner_id/i },
  // --- Chat / atendimento ---
  { key: "whatsapp_widget", label: "WhatsApp", cat: "chat", re: /wa\.me\/|api\.whatsapp\.com\/send|whatsapp.*float|joinchat/i },
  { key: "tawkto", label: "Tawk.to", cat: "chat", re: /tawk\.to|embed\.tawk/i },
  { key: "jivochat", label: "JivoChat", cat: "chat", re: /jivosite|jivo_api|jivochat/i },
  { key: "zendesk", label: "Zendesk", cat: "chat", re: /zdassets\.com|zendesk|zEmbed/i },
  { key: "intercom", label: "Intercom", cat: "chat", re: /intercom\.io|intercomSettings|widget\.intercom/i },
  { key: "crisp", label: "Crisp", cat: "chat", re: /crisp\.chat|\$crisp/i },
  // --- Marketing / automação ---
  { key: "rdstation", label: "RD Station", cat: "marketing", re: /rdstation|d335luupugsy2\.cloudfront|rd-js/i },
  { key: "hubspot", label: "HubSpot", cat: "marketing", re: /hs-scripts\.com|hubspot|hs-analytics|hsforms/i },
  { key: "activecampaign", label: "ActiveCampaign", cat: "marketing", re: /activehosted\.com|activecampaign|prieco/i },
  { key: "mailchimp", label: "Mailchimp", cat: "marketing", re: /list-manage\.com|mailchimp|mc\.us\d/i },
  // --- Framework (informativo) ---
  { key: "react", label: "React", cat: "framework", re: /__REACT|data-reactroot|react\.production/i },
  { key: "nextjs", label: "Next.js", cat: "framework", re: /__NEXT_DATA__|\/_next\//i },
  { key: "vue", label: "Vue", cat: "framework", re: /vue(\.min)?\.js|data-v-[0-9a-f]{8}|__vue__/i },
  { key: "jquery", label: "jQuery", cat: "framework", re: /jquery(\.min)?\.js|jQuery/i },
];

interface Tech {
  cms: string | null;
  builder: string | null;
  ecommerce: string[];
  analytics: string[];
  pixels: string[];
  chat: string[];
  marketing: string[];
  framework: string[];
  has_pixel: boolean;
  has_analytics: boolean;
  is_ecommerce: boolean;
  checked_at: string;
  ok: boolean; // conseguiu baixar o site
}

function detect(html: string, headers: string): Tech {
  const hay = html + "\n" + headers;
  const hit = (s: Sig) => s.re.test(s.hdr ? hay : html);
  const byCat: Record<string, string[]> = {};
  for (const s of SIGNATURES) {
    if (hit(s)) (byCat[s.cat] ??= []).push(s.label);
  }
  const first = (c: string) => (byCat[c]?.[0] ?? null);
  const arr = (c: string) => byCat[c] ?? [];
  const ok = has(html);
  return {
    cms: first("cms"),
    builder: first("builder"),
    ecommerce: arr("ecommerce"),
    analytics: arr("analytics"),
    pixels: arr("pixel"),
    chat: arr("chat"),
    marketing: arr("marketing"),
    framework: arr("framework"),
    has_pixel: arr("pixel").length > 0,
    has_analytics: arr("analytics").length > 0,
    is_ecommerce: arr("ecommerce").length > 0,
    checked_at: new Date().toISOString(),
    ok,
  };
}

async function detectForSite(website: string): Promise<Tech> {
  const base = website.startsWith("http") ? website : `https://${website}`;
  const { html, headers } = await fetchDoc(base);
  return detect(html, headers);
}

interface Body { leadIds?: string[]; limit?: number; redetect?: boolean }
interface LeadRow { id: string; company_name: string; website: string | null; tech: unknown }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });

    const authTok = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authTok) return json({ error: "unauthorized" }, 401);
    const { data: u, error: ue } = await admin.auth.getUser(authTok);
    if (ue || !u?.user) return json({ error: "unauthorized" }, 401);
    const { data: prof } = await admin.from("profiles").select("account_id").eq("id", u.user.id).single();
    const accountId = prof?.account_id;
    if (!accountId) return json({ error: "no_account" }, 400);

    // gate: detecção de tecnologia é Pro+
    const { data: gAcc } = await admin.from("accounts").select("plan").eq("id", accountId).single();
    const { data: gRoles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
    const gIsAdmin = (gRoles ?? []).some((r: { role: string }) => r.role === "admin");
    const gTier = ({ free: 0, starter: 0, pro: 1, business: 2 } as Record<string, number>)[(gAcc?.plan ?? "starter").toLowerCase()] ?? 0;
    if (!gIsAdmin && gTier < 1) return json({ error: "feature_gated", message: "A detecção de tecnologia está disponível nos planos Pro e Business." }, 402);

    const { leadIds, limit, redetect }: Body = await req.json().catch(() => ({}));
    const cap = Math.min(Math.max(1, limit ?? 40), 40);

    // Leads elegíveis: têm website, da conta do usuário. Por padrão só os ainda não checados.
    let qb = admin.from("leads").select("id, company_name, website, tech").eq("account_id", accountId).not("website", "is", null);
    if (Array.isArray(leadIds) && leadIds.length) qb = qb.in("id", leadIds.slice(0, 400));
    const { data: all, error: qe } = await qb;
    if (qe) return json({ error: "query_failed", message: qe.message }, 500);

    const eligible = (all ?? [])
      .filter((l: LeadRow) => has(l.website) && (redetect || l.tech == null))
      .slice(0, cap);
    if (!eligible.length) return json({ processed: 0, detected: 0, failed: 0, results: [] });

    // Lotes concorrentes p/ não estourar o tempo da função.
    const results: { lead: LeadRow; tech: Tech }[] = [];
    const CONC = 5;
    for (let i = 0; i < eligible.length; i += CONC) {
      const chunk = eligible.slice(i, i + CONC) as LeadRow[];
      const found = await Promise.all(chunk.map(async (lead) => ({ lead, tech: await detectForSite(lead.website!) })));
      results.push(...found);
    }

    let detected = 0, failed = 0;
    const events: Record<string, unknown>[] = [];
    const out: { leadId: string; company: string; tech: Tech | null }[] = [];
    for (const { lead, tech } of results) {
      const { error: upErr } = await admin.from("leads").update({ tech }).eq("id", lead.id);
      if (!upErr && tech.ok) {
        detected++;
        events.push({ lead_id: lead.id, account_id: accountId, type: "tech_detected", payload: { cms: tech.cms, has_pixel: tech.has_pixel, is_ecommerce: tech.is_ecommerce } });
        out.push({ leadId: lead.id, company: lead.company_name, tech });
      } else {
        failed++;
        out.push({ leadId: lead.id, company: lead.company_name, tech: tech.ok ? tech : null });
      }
    }
    if (events.length) await admin.from("lead_events").insert(events);

    const processed = eligible.length;
    return json({ processed, detected, failed, results: out });
  } catch (e) {
    return json({ error: "unexpected", message: String((e as Error).message ?? e) }, 500);
  }
});
