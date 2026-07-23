// Extração de leads via busca em websites: Google Custom Search encontra sites do nicho+local,
// e cada página é lida p/ extrair e-mail/telefone (regex). Dedupe por site/telefone, score, grava `searches`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { planCap } from "../_shared/plans.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const has = (v?: string | null) => !!(v && String(v).trim() !== "" && String(v).trim() !== "—");
const scoreOf = (l: { phone?: string | null; address?: string | null; email?: string | null; website?: string | null; nicheQuality?: number | null }) =>
  Math.min(100, (has(l.phone) ? 30 : 0) + (has(l.address) ? 15 : 0) + (has(l.email) ? 25 : 0) + (has(l.website) ? 20 : 0) + Math.max(0, Math.min(10, l.nicheQuality ?? 0)));
const normPhone = (p?: string | null) => (p ? String(p).replace(/\D/g, "").replace(/^0+/, "") : "");
const normSite = (w?: string | null) => {
  if (!w) return "";
  try { return new URL(w.startsWith("http") ? w : `https://${w}`).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return String(w).trim().toLowerCase(); }
};

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?55\s?)?(?:\(?\d{2}\)?[\s.-]?)?\d{4,5}[\s.-]?\d{4}/g;
const BAD_EMAIL = /(example|sentry|wixpress|\.png|\.jpg|\.gif|\.svg)/i;

async function fetchText(url: string, ms = 8000): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await (await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 maisLEAD-bot" } })).text(); }
  catch { return ""; } finally { clearTimeout(t); }
}

interface Body { niche?: string; location?: string; limit?: number; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const KEY = Deno.env.get("GOOGLE_CUSTOM_SEARCH_API_KEY");
    const CX = Deno.env.get("GOOGLE_CSE_CX");
    if (!KEY || !CX) return json({ error: "missing_api_key", message: "Configure GOOGLE_CUSTOM_SEARCH_API_KEY e GOOGLE_CSE_CX." }, 400);

    const { niche, location, limit }: Body = await req.json().catch(() => ({}));
    if (!niche?.trim()) return json({ error: "missing_niche" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });
    const authTok = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authTok) return json({ error: "unauthorized" }, 401);
    const { data: u, error: ue } = await admin.auth.getUser(authTok);
    if (ue || !u?.user) return json({ error: "unauthorized" }, 401);
    const userId = u.user.id;
    const { data: prof } = await admin.from("profiles").select("account_id").eq("id", userId).single();
    const accountId = prof?.account_id;
    if (!accountId) return json({ error: "no_account" }, 400);

    const { data: acc } = await admin.from("accounts").select("plan, extraction_count_month, extraction_reset_at").eq("id", accountId).single();
    let count = acc?.extraction_count_month ?? 0;
    const resetAt = acc?.extraction_reset_at ? new Date(acc.extraction_reset_at) : new Date();
    const now = new Date();
    if (resetAt.getUTCFullYear() !== now.getUTCFullYear() || resetAt.getUTCMonth() !== now.getUTCMonth()) {
      count = 0;
      await admin.from("accounts").update({ extraction_count_month: 0, extraction_reset_at: now.toISOString() }).eq("id", accountId);
    }
    const cap = planCap(acc?.plan);
    const remaining = cap === Infinity ? Infinity : Math.max(0, cap - count);
    if (remaining <= 0) return json({ error: "limit_reached", cap, used: count }, 402);

    const query = `${niche.trim()}${location?.trim() ? " " + location.trim() : ""}`;

    const items: any[] = [];
    for (let start = 1; start <= 21 && items.length < 30; start += 10) {
      const u2 = new URL("https://www.googleapis.com/customsearch/v1");
      u2.searchParams.set("key", KEY); u2.searchParams.set("cx", CX);
      u2.searchParams.set("q", query); u2.searchParams.set("num", "10");
      u2.searchParams.set("start", String(start)); u2.searchParams.set("gl", "br"); u2.searchParams.set("hl", "pt-BR");
      const j = await (await fetch(u2.toString())).json();
      if (j.error) return json({ error: "cse_error", message: j.error?.message ?? null }, 502);
      for (const it of j.items ?? []) items.push(it);
      if (!j.items?.length) break;
    }

    const { data: existing } = await admin.from("leads").select("phone, website").eq("account_id", accountId);
    const seenPhones = new Set((existing ?? []).map((e: any) => normPhone(e.phone)).filter(Boolean));
    const seenSites = new Set((existing ?? []).map((e: any) => normSite(e.website)).filter(Boolean));

    const wanted = Math.min(items.length, remaining === Infinity ? items.length : remaining, limit ?? 20);
    const rows: any[] = [];
    let skipped = 0;

    for (const it of items) {
      if (rows.length >= wanted) break;
      const website = it.link as string;
      const ns = normSite(website);
      if (ns && seenSites.has(ns)) { skipped++; continue; }

      const html = await fetchText(website);
      const emails = [...new Set((html.match(EMAIL_RE) ?? []).filter((e) => !BAD_EMAIL.test(e)))];
      const phones = [...new Set((html.match(PHONE_RE) ?? []).map((p) => p.trim()).filter((p) => normPhone(p).length >= 10))];
      const email = emails[0] ?? null;
      const phone = phones[0] ?? null;
      const np = normPhone(phone);
      if (np && seenPhones.has(np)) { skipped++; continue; }
      if (ns) seenSites.add(ns);
      if (np) seenPhones.add(np);

      const company = (it.title ?? ns).split(/[|\-–—:]/)[0].trim().slice(0, 120);
      const nq = 5;
      rows.push({
        company_name: company || ns, industry: niche.trim(), location: location?.trim() || null,
        phone, email, website, address: null, account_id: accountId, user_id: userId, source: "website",
        status: "new", niche_quality: nq, score: scoreOf({ phone, address: null, email, website, nicheQuality: nq }), extraction_date: new Date().toISOString(),
      });
    }

    let inserted: { id: string }[] = [];
    if (rows.length) {
      const { data, error } = await admin.from("leads").insert(rows).select("id");
      if (error) return json({ error: "insert_failed", message: error.message }, 500);
      inserted = data ?? [];
      if (inserted.length) await admin.from("lead_events").insert(inserted.map((l) => ({ lead_id: l.id, account_id: accountId, type: "created", payload: { source: "website", query } })));
      await admin.from("accounts").update({ extraction_count_month: count + inserted.length }).eq("id", accountId);
    }
    await admin.from("searches").insert({ account_id: accountId, query: niche.trim(), location: location?.trim() || null, source: "website", count: inserted.length });

    return json({
      inserted: inserted.length, skipped, found: items.length, cap: cap === Infinity ? null : cap, used: count + inserted.length,
      preview: rows.slice(0, 8).map((r) => ({ company_name: r.company_name, phone: r.phone, email: r.email, website: r.website, score: r.score })),
    });
  } catch (e) {
    return json({ error: "unexpected", message: String((e as Error).message ?? e) }, 500);
  }
});
