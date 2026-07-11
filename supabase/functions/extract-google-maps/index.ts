// Extração real de leads via Google Places API (Text Search + Details).
// Dedupe por telefone/website dentro da conta, score idêntico ao front (src/lib/score.ts),
// grava histórico em `searches`, respeita o limite do plano (accounts.extraction_count_month).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const has = (v?: string | null) => !!(v && String(v).trim() !== "" && String(v).trim() !== "—");
const scoreOf = (l: { phone?: string | null; address?: string | null; email?: string | null; website?: string | null; nicheQuality?: number | null }) =>
  Math.min(100, (has(l.phone) ? 30 : 0) + (has(l.address) ? 15 : 0) + (has(l.email) ? 25 : 0) + (has(l.website) ? 20 : 0) + Math.max(0, Math.min(10, l.nicheQuality ?? 0)));
const PLAN_CAPS: Record<string, number> = { free: 50, starter: 50, pro: 2000, business: 5000 };
const planCap = (p?: string | null) => PLAN_CAPS[(p ?? "starter").toLowerCase()] ?? 50;
const normPhone = (p?: string | null) => (p ? String(p).replace(/\D/g, "").replace(/^0+/, "") : "");
const normSite = (w?: string | null) => {
  if (!w) return "";
  try { return new URL(w.startsWith("http") ? w : `https://${w}`).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return String(w).trim().toLowerCase(); }
};

interface Body { niche?: string; location?: string; limit?: number; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!KEY) return json({ error: "missing_api_key", message: "Configure o secret GOOGLE_MAPS_API_KEY." }, 400);

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

    // Admin não tem limite (conta vitalícia), independente do plano.
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
    const cap = isAdmin ? Infinity : planCap(acc?.plan);
    const remaining = cap === Infinity ? Infinity : Math.max(0, cap - count);
    if (remaining <= 0) return json({ error: "limit_reached", cap, used: count }, 402);

    const query = `${niche.trim()}${location?.trim() ? " em " + location.trim() : ""}`;

    // 1) Text Search (até ~60 resultados)
    const found: any[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 3 && found.length < 60; page++) {
      const url = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
      url.searchParams.set("query", query);
      url.searchParams.set("language", "pt-BR");
      url.searchParams.set("key", KEY);
      if (pageToken) url.searchParams.set("pagetoken", pageToken);
      const r = await fetch(url.toString());
      const j = await r.json();
      if (j.status && j.status !== "OK" && j.status !== "ZERO_RESULTS") return json({ error: "places_error", status: j.status, message: j.error_message ?? null }, 502);
      for (const it of j.results ?? []) found.push(it);
      pageToken = j.next_page_token;
      if (!pageToken) break;
      await new Promise((res) => setTimeout(res, 1800));
    }

    // 2) Dedupe
    const { data: existing } = await admin.from("leads").select("phone, website").eq("account_id", accountId);
    const seenPhones = new Set((existing ?? []).map((e: any) => normPhone(e.phone)).filter(Boolean));
    const seenSites = new Set((existing ?? []).map((e: any) => normSite(e.website)).filter(Boolean));

    const wanted = Math.min(found.length, remaining === Infinity ? found.length : remaining, limit ?? 60);
    const rows: any[] = [];
    let skipped = 0;

    for (const place of found) {
      if (rows.length >= wanted) break;
      let phone: string | null = null, website: string | null = null;
      if (place.place_id) {
        const du = new URL("https://maps.googleapis.com/maps/api/place/details/json");
        du.searchParams.set("place_id", place.place_id);
        du.searchParams.set("fields", "formatted_phone_number,international_phone_number,website");
        du.searchParams.set("language", "pt-BR");
        du.searchParams.set("key", KEY);
        const dj = await (await fetch(du.toString())).json();
        phone = dj.result?.international_phone_number ?? dj.result?.formatted_phone_number ?? null;
        website = dj.result?.website ?? null;
      }
      const np = normPhone(phone), ns = normSite(website);
      if ((np && seenPhones.has(np)) || (ns && seenSites.has(ns))) { skipped++; continue; }
      if (np) seenPhones.add(np);
      if (ns) seenSites.add(ns);

      const address = place.formatted_address ?? null;
      const nq = place.rating ? Math.round(Math.min(10, place.rating * 2)) : 5;
      rows.push({
        company_name: place.name, address, location: location?.trim() || null, industry: niche.trim(),
        phone, website, email: null, rating: place.rating ?? null, user_ratings_total: place.user_ratings_total ?? null,
        type: "place", account_id: accountId, user_id: userId, source: "google_maps", status: "new",
        niche_quality: nq, score: scoreOf({ phone, address, email: null, website, nicheQuality: nq }), extraction_date: new Date().toISOString(),
      });
    }

    let inserted: { id: string }[] = [];
    if (rows.length) {
      const { data, error } = await admin.from("leads").insert(rows).select("id");
      if (error) return json({ error: "insert_failed", message: error.message }, 500);
      inserted = data ?? [];
      if (inserted.length) await admin.from("lead_events").insert(inserted.map((l) => ({ lead_id: l.id, account_id: accountId, type: "created", payload: { source: "google_maps", query } })));
      await admin.from("accounts").update({ extraction_count_month: count + inserted.length }).eq("id", accountId);
    }
    await admin.from("searches").insert({ account_id: accountId, query: niche.trim(), location: location?.trim() || null, source: "google_maps", count: inserted.length });

    return json({
      inserted: inserted.length, skipped, found: found.length, cap: cap === Infinity ? null : cap, used: count + inserted.length,
      preview: rows.map((r) => ({ company_name: r.company_name, phone: r.phone, website: r.website, address: r.address, email: r.email, score: r.score })),
    });
  } catch (e) {
    return json({ error: "unexpected", message: String((e as Error).message ?? e) }, 500);
  }
});
