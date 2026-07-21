// supabase/functions/search-overture/index.ts  (v2)
//
// Busca leads via Overture Maps (cache lazy em leads_base) E salva os
// resultados na tabela `leads`, respeitando cota do plano, dedupe e score —
// exatamente como a extract-google-maps faz, pra consistência total.
//
// Segredos: OVERTURE_SERVICE_URL, OVERTURE_SERVICE_KEY,
//           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const MIN_CACHE_RESULTS = 5;

// ---- helpers de score/dedupe (idênticos à extract-google-maps) ----
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

// ---- mapa de nicho -> categorias Overture (fallback pra keyword) ----
const NICHE_MAP: Record<string, string[]> = {
  restaurante: ["restaurant", "fast_food_restaurant", "cafe", "pizza_restaurant"],
  restaurantes: ["restaurant", "fast_food_restaurant", "cafe", "pizza_restaurant"],
  restaurant: ["restaurant", "fast_food_restaurant", "cafe", "pizza_restaurant"],
  supermercado: ["grocery_store", "supermarket"],
  supermercados: ["grocery_store", "supermarket"],
  academia: ["gym", "fitness_center", "sports_and_fitness_instruction"],
  academias: ["gym", "fitness_center", "sports_and_fitness_instruction"],
  gym: ["gym", "fitness_center", "sports_and_fitness_instruction"],
  clinica: ["medical_clinic", "doctor", "health_and_medical"],
  clinicas: ["medical_clinic", "doctor", "health_and_medical"],
  "clínica": ["medical_clinic", "doctor", "health_and_medical"],
  "clínicas": ["medical_clinic", "doctor", "health_and_medical"],
  clinic: ["medical_clinic", "doctor", "health_and_medical"],
  madeireira: ["lumber_store", "building_supply_store", "hardware_store"],
  madeireiras: ["lumber_store", "building_supply_store", "hardware_store"],
  reforma: ["contractor", "general_contractor", "home_improvement_store", "construction"],
  reformas: ["contractor", "general_contractor", "home_improvement_store", "construction"],
  remodeling: ["contractor", "general_contractor", "home_improvement_store", "construction"],
  piso: ["flooring_store", "flooring_contractor", "tile_store"],
  pisos: ["flooring_store", "flooring_contractor", "tile_store"],
  flooring: ["flooring_store", "flooring_contractor", "tile_store"],
  advocacia: ["lawyer", "legal_services", "law_firm"],
  advogado: ["lawyer", "legal_services", "law_firm"],
  advogados: ["lawyer", "legal_services", "law_firm"],
  estetica: ["beauty_salon", "spa", "skin_care_clinic", "hair_salon"],
  "estética": ["beauty_salon", "spa", "skin_care_clinic", "hair_salon"],
  beauty: ["beauty_salon", "spa", "skin_care_clinic", "hair_salon"],
  imobiliaria: ["real_estate_agent", "real_estate"],
  "imobiliária": ["real_estate_agent", "real_estate"],
  imoveis: ["real_estate_agent", "real_estate"],
  "imóveis": ["real_estate_agent", "real_estate"],
  granito: ["granite_supplier", "countertop_installation", "stone_supplier"],
  marmore: ["granite_supplier", "countertop_installation", "stone_supplier"],
  "mármore": ["granite_supplier", "countertop_installation", "stone_supplier"],
  granite: ["granite_supplier", "countertop_installation", "stone_supplier"],
};
function resolveNiche(niche: string) {
  const key = niche.trim().toLowerCase();
  return { categories: NICHE_MAP[key] || [], keywords: [key] };
}

interface Body { niche?: string; bbox?: { min_lon: number; min_lat: number; max_lon: number; max_lat: number }; city?: string; region?: string; country?: string; limit?: number; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { niche, bbox, city, region, country, limit }: Body = await req.json().catch(() => ({}));
    if (!niche?.trim()) return json({ error: "missing_niche" }, 400);
    if (!bbox) return json({ error: "missing_bbox" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ---- auth + conta ----
    const authTok = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authTok) return json({ error: "unauthorized" }, 401);
    const { data: u, error: ue } = await admin.auth.getUser(authTok);
    if (ue || !u?.user) return json({ error: "unauthorized" }, 401);
    const userId = u.user.id;
    const { data: prof } = await admin.from("profiles").select("account_id").eq("id", userId).single();
    const accountId = prof?.account_id;
    if (!accountId) return json({ error: "no_account" }, 400);

    // ---- cota do plano (com reset mensal, igual ao Google) ----
    const { data: acc } = await admin.from("accounts").select("plan, extraction_count_month, extraction_reset_at").eq("id", accountId).single();
    let count = acc?.extraction_count_month ?? 0;
    const resetAt = acc?.extraction_reset_at ? new Date(acc.extraction_reset_at) : new Date();
    const now = new Date();
    if (resetAt.getUTCFullYear() !== now.getUTCFullYear() || resetAt.getUTCMonth() !== now.getUTCMonth()) {
      count = 0;
      await admin.from("accounts").update({ extraction_count_month: 0, extraction_reset_at: now.toISOString() }).eq("id", accountId);
    }
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
    const cap = isAdmin ? Infinity : planCap(acc?.plan);
    const remaining = cap === Infinity ? Infinity : Math.max(0, cap - count);
    if (remaining <= 0) return json({ error: "limit_reached", cap, used: count }, 402);

    const { categories, keywords } = resolveNiche(niche);

    // ---- 1) tenta cache no leads_base ----
    async function readCache() {
      let q = admin.from("leads_base").select("*").ilike("city", city ? `%${city}%` : "%");
      if (categories.length > 0) q = q.in("category", categories);
      else q = q.ilike("company_name", `%${keywords[0]}%`);
      const { data } = await q.limit(200);
      return data ?? [];
    }
    let baseLeads = await readCache();

    // ---- 2) cache fraco -> busca no serviço Overture (Render) e popula leads_base ----
    let overtureSource = "cache";
    if (baseLeads.length < MIN_CACHE_RESULTS) {
      overtureSource = "overture";
      const serviceUrl = Deno.env.get("OVERTURE_SERVICE_URL")!;
      const serviceKey = Deno.env.get("OVERTURE_SERVICE_KEY")!;
      const ovRes = await fetch(`${serviceUrl}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": serviceKey },
        body: JSON.stringify({ categories, keywords, bbox, limit: 200 }),
      });
      if (ovRes.ok) {
        const ovData = await ovRes.json();
        const found = ovData.results ?? [];
        if (found.length > 0) {
          const baseRows = found.map((r: any) => ({
            source: "overture", external_id: r.external_id, company_name: r.company_name,
            category: r.category, address: r.address, city: r.city || city || null,
            region: r.region || region || null, country: r.country || country || null,
            phone: r.phone, website: r.website, latitude: r.latitude, longitude: r.longitude,
            raw: r, last_verified_at: new Date().toISOString(),
          }));
          await admin.from("leads_base").upsert(baseRows, { onConflict: "source,external_id", ignoreDuplicates: false });
          baseLeads = await readCache(); // relê já deduplicado do banco
        }
      } else {
        // Overture falhou: se não temos cache nenhum, erro; senão segue com o que tem
        if (baseLeads.length === 0) {
          const txt = await ovRes.text();
          return json({ error: "overture_failed", detail: txt }, 502);
        }
      }
    }

    if (baseLeads.length === 0) {
      return json({ inserted: 0, skipped: 0, found: 0, source: overtureSource, cap: cap === Infinity ? null : cap, used: count, preview: [] });
    }

    // ---- 3) dedupe contra os leads já existentes NA CONTA (igual ao Google) ----
    const { data: existing } = await admin.from("leads").select("phone, website").eq("account_id", accountId);
    const seenPhones = new Set((existing ?? []).map((e: any) => normPhone(e.phone)).filter(Boolean));
    const seenSites = new Set((existing ?? []).map((e: any) => normSite(e.website)).filter(Boolean));

    const wanted = Math.min(baseLeads.length, remaining === Infinity ? baseLeads.length : remaining, limit ?? 200);
    const rows: any[] = [];
    let skipped = 0;

    for (const b of baseLeads) {
      if (rows.length >= wanted) break;
      const phone = b.phone ?? null;
      const website = b.website ?? null;
      const address = b.address ?? null;
      const np = normPhone(phone), ns = normSite(website);
      if ((np && seenPhones.has(np)) || (ns && seenSites.has(ns))) { skipped++; continue; }
      if (np) seenPhones.add(np);
      if (ns) seenSites.add(ns);

      // qualidade de nicho: sem rating no Overture base, usa 5 (neutro) como o Google faz quando não tem
      const nq = 5;
      rows.push({
        company_name: b.company_name, address, location: city || null, industry: niche.trim(),
        phone, website, email: null, rating: null, user_ratings_total: null,
        type: "place", account_id: accountId, user_id: userId, source: "overture", status: "new",
        niche_quality: nq, score: scoreOf({ phone, address, email: null, website, nicheQuality: nq }),
        base_lead_id: b.id, extraction_date: new Date().toISOString(),
      });
    }

    // ---- 4) insere em leads + lead_events + atualiza cota + searches ----
    let inserted: { id: string }[] = [];
    if (rows.length) {
      const { data, error } = await admin.from("leads").insert(rows).select("id");
      if (error) return json({ error: "insert_failed", message: error.message }, 500);
      inserted = data ?? [];
      if (inserted.length) {
        await admin.from("lead_events").insert(inserted.map((l) => ({
          lead_id: l.id, account_id: accountId, type: "created", payload: { source: "overture", niche: niche.trim(), city },
        })));
        await admin.from("accounts").update({ extraction_count_month: count + inserted.length }).eq("id", accountId);
      }
    }
    await admin.from("searches").insert({ account_id: accountId, query: niche.trim(), location: city || null, source: "overture", count: inserted.length });

    return json({
      inserted: inserted.length, skipped, found: baseLeads.length, source: overtureSource,
      cap: cap === Infinity ? null : cap, used: count + inserted.length,
      preview: rows.map((r) => ({ company_name: r.company_name, phone: r.phone, website: r.website, address: r.address, email: r.email, score: r.score })),
    });
  } catch (e) {
    return json({ error: "unexpected", message: String((e as Error).message ?? e) }, 500);
  }
});
