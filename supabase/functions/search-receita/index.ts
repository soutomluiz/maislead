// Busca de "empresas recém-abertas" na base local rf_estabelecimento (populada pela ingestão
// da Receita — dump grátis hoje, API paga no futuro; esta função NÃO sabe a origem).
//   mode="search" → filtra e retorna preview paginado (NÃO grava, marca duplicados). Não consome cota.
//   mode="import" → grava os CNPJs selecionados como leads (consome cota; valida limite). Admin = ilimitado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const has = (v?: string | null) => !!(v && String(v).trim() !== "" && String(v).trim() !== "—");
const scoreOf = (l: { phone?: string | null; address?: string | null; email?: string | null; nicheQuality?: number | null }) =>
  Math.min(100, (has(l.phone) ? 30 : 0) + (has(l.address) ? 15 : 0) + (has(l.email) ? 25 : 0) + Math.max(0, Math.min(10, l.nicheQuality ?? 0)));
const PLAN_CAPS: Record<string, number> = { free: 50, starter: 50, pro: 2000, business: Infinity };
const planCap = (p?: string | null) => PLAN_CAPS[(p ?? "starter").toLowerCase()] ?? 50;

const onlyDigits = (s: string) => String(s).replace(/\D/g, "");
const fmtCnpj = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
// Remove o prefixo de CNPJ que a Receita coloca na razão social de MEI (ex.: "67.305.103 FULANO").
const stripDoc = (s?: string | null) => (s ? String(s).replace(/^\d{2}\.?\d{3}\.?\d{3}(\/?\d{4}-?\d{2})?\s+/, "").trim() : s ?? "");
const titleCase = (s?: string | null) => (s ? String(stripDoc(s)).toLowerCase().replace(/(^|[\s\-/(])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase()) : "");
const fmtBRL = (n?: number | string | null) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || Number.isNaN(v)) return null;
  try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v); } catch { return `R$ ${v}`; }
};
function fmtPhone(ddd?: string | null, tel?: string | null): string | null {
  const d = onlyDigits(`${ddd ?? ""}${tel ?? ""}`);
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return d ? d : null;
}
const PORTE: Record<number, string> = { 1: "ME (Microempresa)", 3: "EPP (Pequeno Porte)", 5: "Demais" };
const SITU: Record<number, string> = { 1: "Nula", 2: "Ativa", 3: "Suspensa", 4: "Inapta", 8: "Baixada" };
const fmtDate = (d?: string | null) => (d ? String(d).slice(0, 10) : null);

interface Filters { days?: number; uf?: string; cnae?: string; cnaes?: string[]; mei?: boolean | null; onlyEmail?: boolean; q?: string; }
interface Body { mode?: "search" | "import" | "cnaes"; filters?: Filters; page?: number; cnpjs?: string[]; }

interface Row {
  cnpj: string; cnpj_basico: string; razao_social: string | null; nome_fantasia: string | null;
  situacao: number | null; data_abertura: string | null; cnae_principal: string | null;
  porte: number | null; capital_social: number | null; opcao_mei: boolean | null; opcao_simples: boolean | null;
  uf: string | null; municipio_nome: string | null; bairro: string | null; cep: string | null;
  ddd1: string | null; telefone1: string | null; email: string | null;
}

const PAGE_SIZE = 50;
const MAX_IMPORT = 100;

function cutoffDate(days: number): string {
  const d = new Date(); d.setDate(d.getDate() - (days > 0 ? days : 60));
  return d.toISOString().slice(0, 10);
}

function baseQuery(admin: ReturnType<typeof createClient>, f: Filters, forCount = false) {
  let q = admin.from("rf_estabelecimento").select("*", forCount ? { count: "exact", head: true } : undefined)
    .gte("data_abertura", cutoffDate(f.days ?? 60))
    .eq("situacao", 2);
  if (f.uf) q = q.eq("uf", f.uf.toUpperCase());
  if (f.cnaes && f.cnaes.length) q = q.in("cnae_principal", f.cnaes.map((c) => onlyDigits(c).padStart(7, "0")));
  else if (f.cnae) q = q.eq("cnae_principal", onlyDigits(f.cnae).padStart(7, "0"));
  if (f.mei === true || f.mei === false) q = q.eq("opcao_mei", f.mei);
  if (f.onlyEmail) q = q.not("email", "is", null);
  if (f.q && f.q.trim()) { const t = f.q.trim().replace(/[%,]/g, ""); q = q.or(`razao_social.ilike.%${t}%,nome_fantasia.ilike.%${t}%`); }
  return q;
}

function mapPreview(r: Row, cnaeDesc: Map<string, string>, duplicate: boolean) {
  const company = titleCase(r.nome_fantasia) || titleCase(r.razao_social);
  return {
    cnpj: r.cnpj, cnpjFmt: fmtCnpj(r.cnpj), company,
    razao_social: titleCase(r.razao_social), nome_fantasia: titleCase(r.nome_fantasia),
    cnae: r.cnae_principal ? (cnaeDesc.get(r.cnae_principal) ?? r.cnae_principal) : null,
    porte: r.porte != null ? (PORTE[r.porte] ?? String(r.porte)) : null,
    mei: !!r.opcao_mei, abertura: fmtDate(r.data_abertura), capital: fmtBRL(r.capital_social),
    uf: r.uf, municipio: r.municipio_nome, email: r.email, phone: fmtPhone(r.ddd1, r.telefone1),
    situacao: r.situacao != null ? (SITU[r.situacao] ?? String(r.situacao)) : null,
    duplicate,
  };
}

async function cnaeMap(admin: ReturnType<typeof createClient>, codes: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(codes.filter(Boolean))];
  const m = new Map<string, string>();
  if (!uniq.length) return m;
  const { data } = await admin.from("rf_cnae").select("codigo, descricao").in("codigo", uniq);
  for (const c of (data ?? []) as { codigo: string; descricao: string }[]) m.set(c.codigo, titleCase(c.descricao));
  return m;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });

    const authTok = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authTok) return json({ error: "unauthorized" }, 401);
    const { data: u, error: ue } = await admin.auth.getUser(authTok);
    if (ue || !u?.user) return json({ error: "unauthorized" }, 401);
    const userId = u.user.id;
    const { data: prof } = await admin.from("profiles").select("account_id").eq("id", userId).single();
    const accountId = prof?.account_id;
    if (!accountId) return json({ error: "no_account" }, 400);

    // Conta + cota (reset mensal) + admin.
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
    const plan = (acc?.plan ?? "starter");
    const cap = isAdmin ? Infinity : planCap(plan);
    const quota = (used: number) => ({ used, limit: cap === Infinity ? null : cap, plan, isAdmin });

    const { mode = "search", filters = {}, page = 0, cnpjs }: Body = await req.json().catch(() => ({}));

    // ───── MODO CNAES (lista p/ o dropdown) ─────
    if (mode === "cnaes") {
      const { data } = await admin.from("rf_cnae").select("codigo, descricao").order("descricao");
      return json({ cnaes: (data ?? []).map((c: { codigo: string; descricao: string }) => ({ codigo: c.codigo, descricao: titleCase(c.descricao) })) });
    }

    // duplicados = CNPJ já existente na conta
    const { data: existing } = await admin.from("leads").select("cnpj").eq("account_id", accountId).not("cnpj", "is", null);
    const seenCnpj = new Set((existing ?? []).map((e: { cnpj: string | null }) => onlyDigits(e.cnpj ?? "")).filter(Boolean));

    // ───── MODO SEARCH (preview paginado) ─────
    if (mode === "search") {
      const from = Math.max(0, page) * PAGE_SIZE;
      const { data: rows, error } = await baseQuery(admin, filters)
        .order("data_abertura", { ascending: false })
        .range(from, from + PAGE_SIZE - 1) as { data: Row[] | null; error: unknown };
      if (error) return json({ error: "query_failed", message: String((error as { message?: string }).message ?? error), quota: quota(count) }, 500);
      const { count: total } = await baseQuery(admin, filters, true) as { count: number | null };
      const list = rows ?? [];
      const cd = await cnaeMap(admin, list.map((r) => r.cnae_principal ?? ""));
      const results = list.map((r) => mapPreview(r, cd, seenCnpj.has(r.cnpj)));
      return json({ results, total: total ?? results.length, page, pageSize: PAGE_SIZE, quota: quota(count) });
    }

    // ───── MODO IMPORT (grava selecionados, consome cota) ─────
    const wanted = (Array.isArray(cnpjs) ? cnpjs : []).map(onlyDigits).filter((c) => c.length === 14);
    const targets = [...new Set(wanted)].filter((c) => !seenCnpj.has(c));
    const skippedDup = wanted.length - targets.length;
    if (!targets.length) return json({ inserted: 0, skipped: skippedDup, quota: quota(count) });
    if (!isAdmin && count + targets.length > cap) {
      return json({ error: "limit_reached", allowed: Math.max(0, cap - count), quota: quota(count) }, 402);
    }

    const { data: recs } = await admin.from("rf_estabelecimento").select("*").in("cnpj", targets.slice(0, MAX_IMPORT));
    const list = (recs ?? []) as Row[];
    const cd = await cnaeMap(admin, list.map((r) => r.cnae_principal ?? ""));
    const rows: Record<string, unknown>[] = [];
    for (const r of list) {
      const company = titleCase(r.nome_fantasia) || titleCase(r.razao_social);
      const razao = titleCase(r.razao_social);
      const phone = fmtPhone(r.ddd1, r.telefone1);
      const location = [r.municipio_nome, r.uf].filter(Boolean).join("/") || null;
      const address = [titleCase(r.bairro), location, onlyDigits(r.cep ?? "").replace(/^(\d{5})(\d{3})$/, "$1-$2")].filter(Boolean).join(", ") || null;
      const cnae = r.cnae_principal ? (cd.get(r.cnae_principal) ?? null) : null;
      const nicheQuality = r.situacao === 2 ? 6 : 3;
      const notes = [
        `CNPJ: ${fmtCnpj(r.cnpj)}`,
        razao && company !== razao ? `Razão social: ${razao}` : "",
        r.situacao != null ? `Situação: ${SITU[r.situacao] ?? r.situacao}` : "",
        r.porte != null ? `Porte: ${PORTE[r.porte] ?? r.porte}` : "",
        r.opcao_mei ? "MEI: Sim" : "",
        r.capital_social != null ? `Capital social: ${fmtBRL(r.capital_social)}` : "",
        `Origem: Receita Federal`,
      ].filter(Boolean).join("\n");
      rows.push({
        company_name: company, contact_name: null, industry: cnae, location,
        phone, website: null, email: r.email, address, cnpj: r.cnpj,
        opening_date: fmtDate(r.data_abertura), notes,
        type: "cnpj", account_id: accountId, user_id: userId, source: "receita", status: "new",
        niche_quality: nicheQuality, score: scoreOf({ phone, address, email: r.email, nicheQuality }),
        extraction_date: new Date().toISOString(),
      });
    }

    let inserted: { id: string }[] = [];
    if (rows.length) {
      const { data, error } = await admin.from("leads").insert(rows).select("id");
      if (error) return json({ error: "insert_failed", message: error.message, quota: quota(count) }, 500);
      inserted = data ?? [];
      if (inserted.length) await admin.from("lead_events").insert(inserted.map((l) => ({ lead_id: l.id, account_id: accountId, type: "created", payload: { source: "receita" } })));
      count += inserted.length;
      await admin.from("accounts").update({ extraction_count_month: count }).eq("id", accountId);
    }
    await admin.from("searches").insert({ account_id: accountId, query: `${inserted.length} recém-abertas`, location: filters.uf ?? null, source: "receita", count: inserted.length });

    return json({ inserted: inserted.length, skipped: skippedDup, quota: quota(count) });
  } catch (e) {
    return json({ error: "unexpected", message: String((e as Error).message ?? e) }, 500);
  }
});
