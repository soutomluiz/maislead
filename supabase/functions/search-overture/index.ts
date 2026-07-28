// supabase/functions/search-overture/index.ts  (v3 — Etapa 2: buscar grátis / revelar paga)
//
// action="search"  → GRÁTIS e ilimitado. Popula o cache leads_base e devolve os
//                    resultados com CONTATOS MASCARADOS (máscara feita no SERVIDOR — o
//                    dado completo só sai no reveal / ou quando a conta já é dona do lead).
// action="reveal"  → CONSOME COTA. Insere os leads selecionados em `leads` (dedupe/score)
//                    e devolve os contatos completos. Cota zerada → 402.
//
// Segredos: OVERTURE_SERVICE_URL, OVERTURE_SERVICE_KEY,
//           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { planCap } from "../_shared/plans.ts";

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
const normPhone = (p?: string | null) => (p ? String(p).replace(/\D/g, "").replace(/^0+/, "") : "");
const normSite = (w?: string | null) => {
  if (!w) return "";
  try { return new URL(w.startsWith("http") ? w : `https://${w}`).hostname.replace(/^www\./, "").toLowerCase(); }
  catch { return String(w).trim().toLowerCase(); }
};

// ---- máscara de contato (SERVIDOR) ----
// telefone: mantém país + DDD e os 4 últimos dígitos ("+55 48 ****-6541")
function maskPhone(raw?: string | null): string | null {
  if (!has(raw)) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 4) return "****";
  const last4 = digits.slice(-4);
  let prefix = "";
  let rest = digits;
  if (rest.startsWith("55") && rest.length >= 12) { prefix = "+55 "; rest = rest.slice(2); }
  const ddd = rest.length >= 10 ? rest.slice(0, 2) + " " : "";
  return `${prefix}${ddd}****-${last4}`.trim();
}
// site: mantém o TLD e mascara o domínio ("www.****.com.br")
function maskSite(raw?: string | null): string | null {
  if (!has(raw)) return null;
  let host = "";
  try { host = new URL(String(raw).startsWith("http") ? String(raw) : `https://${raw}`).hostname; }
  catch { host = String(raw).replace(/^https?:\/\//, "").split("/")[0]; }
  host = host.replace(/^www\./, "");
  const parts = host.split(".").filter(Boolean);
  if (parts.length < 2) return "www.****";
  let tldCount = 1;
  if (parts.length >= 3 && ["com", "net", "org", "gov", "edu"].includes(parts[parts.length - 2])) tldCount = 2;
  const tld = parts.slice(-tldCount).join(".");
  return `www.****.${tld}`;
}

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

interface Bbox { min_lon: number; min_lat: number; max_lon: number; max_lat: number; }
interface Body { action?: "search" | "reveal"; niche?: string; bbox?: Bbox; city?: string; region?: string; country?: string; base_lead_ids?: string[]; limit?: number; }

// deno-lint-ignore no-explicit-any
type Admin = any;

// Cota da conta (reset mensal). Retorna { count, cap, remaining, isAdmin }.
async function loadQuota(admin: Admin, accountId: string, userId: string) {
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
  return { count, cap, remaining, isAdmin };
}
const quotaOut = (count: number, cap: number, remaining: number) => ({
  cap: cap === Infinity ? null : cap,
  used: count,
  remaining: remaining === Infinity ? null : remaining,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body: Body = await req.json().catch(() => ({}));
    const action = body.action ?? "search";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
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

    // ════════════════════ REVEAL (consome cota) ════════════════════
    if (action === "reveal") {
      const niche = (body.niche ?? "").trim();
      const city = body.city ?? null;
      const ids = [...new Set((body.base_lead_ids ?? []).filter(Boolean))];
      if (!ids.length) return json({ error: "no_selection" }, 400);

      const { count, cap, remaining, isAdmin } = await loadQuota(admin, accountId, userId);
      if (remaining <= 0) return json({ error: "limit_reached", cap: cap === Infinity ? null : cap, used: count }, 402);

      // O que a conta JÁ possui (por base_lead_id) — não cobra, mas devolve completo.
      const { data: ownedRows } = await admin.from("leads")
        .select("base_lead_id, company_name, phone, website, address, email, score")
        .eq("account_id", accountId).in("base_lead_id", ids);
      const ownedById = new Map<string, { base_lead_id: string; company_name: string; phone: string | null; website: string | null; address: string | null; email: string | null; score: number | null }>();
      for (const r of (ownedRows ?? [])) if (r.base_lead_id) ownedById.set(r.base_lead_id, r);

      const toConsiderIds = ids.filter((id) => !ownedById.has(id));

      // linhas do cache pros ids ainda não possuídos
      const { data: baseRows } = await admin.from("leads_base").select("*").in("id", toConsiderIds);
      const baseById = new Map<string, Record<string, unknown>>();
      for (const b of (baseRows ?? [])) baseById.set(b.id, b);

      // dedupe por telefone/site já existentes NA CONTA
      const { data: existing } = await admin.from("leads").select("phone, website").eq("account_id", accountId);
      // deno-lint-ignore no-explicit-any
      const seenPhones = new Set((existing ?? []).map((e: any) => normPhone(e.phone)).filter(Boolean));
      // deno-lint-ignore no-explicit-any
      const seenSites = new Set((existing ?? []).map((e: any) => normSite(e.website)).filter(Boolean));

      let skippedDuplicate = 0;
      const eligible: Record<string, unknown>[] = [];
      for (const id of toConsiderIds) {
        const b = baseById.get(id);
        if (!b) continue;
        const np = normPhone(b.phone as string), ns = normSite(b.website as string);
        if ((np && seenPhones.has(np)) || (ns && seenSites.has(ns))) { skippedDuplicate++; continue; }
        if (np) seenPhones.add(np);
        if (ns) seenSites.add(ns);
        eligible.push(b);
      }

      // insere só até a cota restante; o resto vira "not_revealed"
      const capacity = remaining === Infinity ? eligible.length : Math.min(eligible.length, remaining);
      const toInsert = eligible.slice(0, capacity);
      const notRevealed = eligible.length - toInsert.length;

      const rows = toInsert.map((b) => {
        const phone = (b.phone as string) ?? null;
        const website = (b.website as string) ?? null;
        const address = (b.address as string) ?? null;
        const nq = 5;
        return {
          company_name: b.company_name, address, location: city || null, industry: niche,
          phone, website, email: null, rating: null, user_ratings_total: null,
          type: "place", account_id: accountId, user_id: userId, source: "overture", status: "new",
          niche_quality: nq, score: scoreOf({ phone, address, email: null, website, nicheQuality: nq }),
          base_lead_id: b.id, extraction_date: new Date().toISOString(),
        };
      });

      let insertedRows: { id: string; base_lead_id: string; company_name: string; phone: string | null; website: string | null; address: string | null; email: string | null; score: number | null }[] = [];
      if (rows.length) {
        const { data: ins, error } = await admin.from("leads").insert(rows).select("id, base_lead_id, company_name, phone, website, address, email, score");
        if (error) return json({ error: "insert_failed", message: error.message }, 500);
        insertedRows = ins ?? [];
        if (insertedRows.length) {
          await admin.from("lead_events").insert(insertedRows.map((l) => ({
            lead_id: l.id, account_id: accountId, type: "created", payload: { source: "overture", niche, city, via: "reveal" },
          })));
          await admin.from("accounts").update({ extraction_count_month: count + insertedRows.length }).eq("id", accountId);
        }
      }

      const newUsed = count + insertedRows.length;
      const newRemaining = cap === Infinity ? Infinity : Math.max(0, cap - newUsed);

      // devolve os revelados agora + os que já eram da conta (completos), pra UI atualizar
      const leadsOut = [
        ...insertedRows.map((l) => ({ base_lead_id: l.base_lead_id, company_name: l.company_name, phone: l.phone, website: l.website, address: l.address, email: l.email, score: l.score })),
        ...[...ownedById.values()].map((l) => ({ base_lead_id: l.base_lead_id, company_name: l.company_name, phone: l.phone, website: l.website, address: l.address, email: l.email, score: l.score })),
      ];

      return json({
        revealed: insertedRows.length,
        already_owned: ownedById.size,
        skipped_duplicate: skippedDuplicate,
        not_revealed: notRevealed,
        quota: quotaOut(newUsed, cap, newRemaining),
        leads: leadsOut,
      });
    }

    // ════════════════════ SEARCH (grátis, mascarado) ════════════════════
    const niche = (body.niche ?? "").trim();
    if (!niche) return json({ error: "missing_niche" }, 400);
    if (!body.bbox) return json({ error: "missing_bbox" }, 400);
    const { bbox, city = null, region = null, country = null } = body;

    // cota só pra INFORMAR (buscar nunca é bloqueado)
    const { count, cap, remaining } = await loadQuota(admin, accountId, userId);

    const { categories, keywords } = resolveNiche(niche);

    async function readCache() {
      let q = admin.from("leads_base").select("*").ilike("city", city ? `%${city}%` : "%");
      if (categories.length > 0) q = q.in("category", categories);
      else q = q.ilike("company_name", `%${keywords[0]}%`);
      const { data } = await q.limit(200);
      return data ?? [];
    }
    let baseLeads = await readCache();

    // cache fraco → chama o serviço Overture (Render) e popula leads_base
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
          // deno-lint-ignore no-explicit-any
          const baseRows = found.map((r: any) => ({
            source: "overture", external_id: r.external_id, company_name: r.company_name,
            category: r.category, address: r.address, city: r.city || city || null,
            region: r.region || region || null, country: r.country || country || null,
            phone: r.phone, website: r.website, latitude: r.latitude, longitude: r.longitude,
            raw: r, last_verified_at: new Date().toISOString(),
          }));
          await admin.from("leads_base").upsert(baseRows, { onConflict: "source,external_id", ignoreDuplicates: false });
          baseLeads = await readCache();
        }
      } else if (baseLeads.length === 0) {
        const txt = await ovRes.text();
        return json({ error: "overture_failed", detail: txt }, 502);
      }
    }

    // registra a busca (dedupe por nicho+cidade: upsert manual, sem constraint nova)
    const found = baseLeads.length;
    {
      let sel = admin.from("searches").select("id").eq("account_id", accountId).eq("query", niche).eq("source", "overture");
      sel = city ? sel.eq("location", city) : sel.is("location", null);
      const { data: ex } = await sel.limit(1);
      if (ex && ex[0]) await admin.from("searches").update({ count: found, created_at: new Date().toISOString() }).eq("id", ex[0].id);
      else await admin.from("searches").insert({ account_id: accountId, query: niche, location: city || null, source: "overture", count: found });
    }

    if (found === 0) {
      return json({ found: 0, source: overtureSource, quota: quotaOut(count, cap, remaining), results: [] });
    }

    // quais desses a conta JÁ possui (por base_lead_id)
    const { data: owned } = await admin.from("leads").select("base_lead_id").eq("account_id", accountId).not("base_lead_id", "is", null);
    const ownedSet = new Set((owned ?? []).map((o: { base_lead_id: string }) => o.base_lead_id));

    // deno-lint-ignore no-explicit-any
    const results = baseLeads.map((b: any) => {
      const alreadyOwned = ownedSet.has(b.id);
      const base = {
        base_lead_id: b.id,
        company_name: b.company_name,
        category: b.category ?? null,
        address: b.address ?? null,
        city: b.city ?? null,
        region: b.region ?? null,
        has_phone: has(b.phone),
        has_website: has(b.website),
        phone_masked: maskPhone(b.phone),
        website_masked: maskSite(b.website),
        already_owned: alreadyOwned,
      };
      // dado COMPLETO só quando a conta já é dona (já pagou por ele)
      if (alreadyOwned) return { ...base, phone: b.phone ?? null, website: b.website ?? null };
      return base;
    });

    return json({ found, source: overtureSource, quota: quotaOut(count, cap, remaining), results });
  } catch (e) {
    return json({ error: "unexpected", message: String((e as Error).message ?? e) }, 500);
  }
});
