// Enriquecimento de e-mail (CUSTO ZERO — sem API paga).
// Pega leads que JÁ têm website mas NÃO têm e-mail, raspa o HTML do site
// (home + páginas de contato, decodificando ofuscação Cloudflare/entidades),
// escolhe o melhor e-mail, atualiza o lead e recalcula o score (+25 do e-mail).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { planAllows } from "../_shared/plans.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const has = (v?: string | null) => !!(v && String(v).trim() !== "" && String(v).trim() !== "—");
const scoreOf = (l: { phone?: string | null; address?: string | null; email?: string | null; website?: string | null; nicheQuality?: number | null }) =>
  Math.min(100, (has(l.phone) ? 30 : 0) + (has(l.address) ? 15 : 0) + (has(l.email) ? 25 : 0) + (has(l.website) ? 20 : 0) + Math.max(0, Math.min(10, l.nicheQuality ?? 0)));

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// e-mails de sistema/placeholder que não servem como contato real
const BAD_EMAIL = /(no-?reply|do-?not-?reply|nao-?responda|naoresponda|sentry|wixpress|@wix\.com|@sentry|godaddy|example\.|yourdomain|seuemail|seudominio|domain\.com|email@|@email\.|\.png|\.jpe?g|\.gif|\.svg|\.webp|\.ico)/i;
// prefixos "de contato" preferidos quando não há e-mail do próprio domínio
const GOOD_PREFIX = /^(contato|contact|comercial|vendas|sac|atendimento|faleconosco|fale|info|hello|ola|oi|adm|administracao|financeiro)@/i;

const hostOf = (w?: string | null) => {
  if (!w) return "";
  try { return new URL(w.startsWith("http") ? w : `https://${w}`).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return ""; }
};

const MAX_HTML = 500_000; // limita CPU/memória do regex por página

async function fetchText(url: string, ms = 6000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (compatible; maisLEAD-bot/1.0)" } });
    if (!r.ok) return "";
    const ct = r.headers.get("content-type") ?? "";
    if (ct && !/(text|html|xml|json|javascript)/i.test(ct)) return "";
    const len = Number(r.headers.get("content-length") ?? 0);
    if (len && len > 3_000_000) return ""; // pula páginas gigantes
    const txt = await r.text();
    return txt.length > MAX_HTML ? txt.slice(0, MAX_HTML) : txt;
  } catch { return ""; } finally { clearTimeout(t); }
}

// Decodifica e-mails ofuscados pelo Cloudflare (data-cfemail="...").
function decodeCfEmails(html: string): string[] {
  const out: string[] = [];
  const re = /data-cfemail="([0-9a-f]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const hex = m[1];
    try {
      const key = parseInt(hex.slice(0, 2), 16);
      let email = "";
      for (let i = 2; i < hex.length; i += 2) email += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
      if (email.includes("@")) out.push(email);
    } catch { /* ignora */ }
  }
  return out;
}

// Normaliza entidades comuns que escondem o @ / . (&#64; &commat; [at] (at) etc.)
function deobfuscate(html: string): string {
  return html
    .replace(/&#0?64;|&commat;/gi, "@").replace(/&#46;/g, ".")
    .replace(/\s*[\[(<{]\s*(at|arroba)\s*[\])>}]\s*/gi, "@")
    .replace(/\s*[\[(<{]\s*(dot|ponto)\s*[\])>}]\s*/gi, ".");
}

function extractEmails(html: string): string[] {
  const deob = deobfuscate(html);
  const found = new Set<string>();
  // prioriza mailto: (mais confiável)
  const mailtos: string[] = [];
  const mt = /mailto:([^"'?>\s]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = mt.exec(deob))) mailtos.push(decodeURIComponent(m[1]));
  for (const e of decodeCfEmails(html)) found.add(e);
  for (const e of mailtos) found.add(e);
  for (const e of deob.match(EMAIL_RE) ?? []) found.add(e);
  return [...found]
    .map((e) => e.trim().toLowerCase().replace(/[.,;:)]+$/, ""))
    .filter((e) => e.length <= 70 && !BAD_EMAIL.test(e) && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(e));
}

// Escolhe o melhor e-mail: 1) do próprio domínio, 2) prefixo de contato, 3) primeiro.
function pickBest(emails: string[], siteHost: string): string | null {
  if (!emails.length) return null;
  const domain = emails.filter((e) => siteHost && e.endsWith("@" + siteHost));
  if (domain.length) return domain.find((e) => GOOD_PREFIX.test(e)) ?? domain[0];
  const good = emails.filter((e) => GOOD_PREFIX.test(e));
  if (good.length) return good[0];
  return emails[0];
}

const CONTACT_PATHS = ["/contato", "/contact", "/fale-conosco", "/contato/", "/contatos"];

async function findEmailForSite(website: string): Promise<string | null> {
  try {
    const host = hostOf(website);
    const base = website.startsWith("http") ? website : `https://${website}`;
    // 1) home
    let emails = extractEmails(await fetchText(base));
    let best = pickBest(emails, host);
    if (best) return best;
    // 2) páginas de contato (uma tentativa, em paralelo)
    let origin = "";
    try { origin = new URL(base).origin; } catch { return null; }
    const pages = await Promise.all(CONTACT_PATHS.slice(0, 2).map((p) => fetchText(origin + p)));
    emails = extractEmails(pages.join("\n"));
    best = pickBest(emails, host);
    return best;
  } catch { return null; }
}

interface Body { leadIds?: string[]; limit?: number; }
interface LeadRow { id: string; company_name: string; phone: string | null; address: string | null; email: string | null; website: string | null; niche_quality: number | null; }

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

    // gate: enriquecimento de e-mails é Pro+
    const { data: gAcc } = await admin.from("accounts").select("plan").eq("id", accountId).single();
    const { data: gRoles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
    const gIsAdmin = (gRoles ?? []).some((r: { role: string }) => r.role === "admin");
    if (!gIsAdmin && !planAllows(gAcc?.plan, "enrich")) return json({ error: "feature_gated", message: "O enriquecimento de e-mails está disponível nos planos Pro e Business." }, 402);

    const { leadIds, limit }: Body = await req.json().catch(() => ({}));
    const cap = Math.min(Math.max(1, limit ?? 40), 40);

    // Leads elegíveis: têm website, não têm e-mail, da conta do usuário.
    let qb = admin.from("leads").select("id, company_name, phone, address, email, website, niche_quality").eq("account_id", accountId).not("website", "is", null);
    if (Array.isArray(leadIds) && leadIds.length) qb = qb.in("id", leadIds.slice(0, 400));
    const { data: all, error: qe } = await qb;
    if (qe) return json({ error: "query_failed", message: qe.message }, 500);

    const eligible = (all ?? []).filter((l: LeadRow) => has(l.website) && !has(l.email)).slice(0, cap);
    if (!eligible.length) return json({ processed: 0, enriched: 0, noEmail: 0, remaining: 0, sample: [] });

    // Processa em pequenos lotes concorrentes p/ não estourar o tempo da função.
    const results: { lead: LeadRow; email: string | null }[] = [];
    const CONC = 5;
    for (let i = 0; i < eligible.length; i += CONC) {
      const chunk = eligible.slice(i, i + CONC) as LeadRow[];
      const found = await Promise.all(chunk.map(async (lead) => ({ lead, email: await findEmailForSite(lead.website!) })));
      results.push(...found);
    }

    let enriched = 0;
    const events: Record<string, unknown>[] = [];
    const out: { leadId: string; company: string; email: string | null }[] = [];
    for (const { lead, email } of results) {
      if (email) {
        const score = scoreOf({ phone: lead.phone, address: lead.address, email, website: lead.website, nicheQuality: lead.niche_quality });
        const { error: upErr } = await admin.from("leads").update({ email, score }).eq("id", lead.id);
        if (!upErr) {
          enriched++;
          events.push({ lead_id: lead.id, account_id: accountId, type: "email_enriched", payload: { email, source: "website_scrape" } });
          out.push({ leadId: lead.id, company: lead.company_name, email });
          continue;
        }
      }
      out.push({ leadId: lead.id, company: lead.company_name, email: null });
    }
    if (events.length) await admin.from("lead_events").insert(events);

    const processed = eligible.length;
    const rate = processed ? Math.round((enriched / processed) * 100) : 0;
    return json({
      processed, found: enriched, notFound: processed - enriched, rate, results: out,
      enriched, noEmail: processed - enriched, remaining: 0, // compat
    });
  } catch (e) {
    return json({ error: "unexpected", message: String((e as Error).message ?? e) }, 500);
  }
});
