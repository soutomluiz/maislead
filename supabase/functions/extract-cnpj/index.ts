// Busca por CNPJ (CUSTO ZERO) — base oficial via BrasilAPI, em 2 modos:
//   mode="lookup"  → só consulta e retorna preview (NÃO grava, marca duplicados). Não consome cota.
//   mode="import"  → grava os CNPJs selecionados como leads (consome cota; valida limite no backend).
// Ambos retornam a `quota` da conta { used, limit, plan, isAdmin } p/ alimentar a barra de cota.
// Admin (conta vitalícia) = limite infinito, independente do plano.
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

const onlyDigits = (s: string) => String(s).replace(/\D/g, "");
function isValidCnpj(c: string): boolean {
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: string) => {
    let sum = 0, pos = base.length - 7;
    for (let i = 0; i < base.length; i++) { sum += parseInt(base[i], 10) * pos--; if (pos < 2) pos = 9; }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(c.slice(0, 12));
  const d2 = calc(c.slice(0, 12) + d1);
  return c.slice(12) === `${d1}${d2}`;
}
const fmtCnpj = (c: string) => c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
function fmtPhone(ddd_tel?: string | null): string | null {
  const d = onlyDigits(ddd_tel ?? "");
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return d ? d : null;
}
// Capitaliza a 1ª letra de cada palavra sem depender do \b ASCII (que quebra em acentos).
const titleCase = (s?: string | null) => (s ? String(s).toLowerCase().replace(/(^|[\s\-/(])(\p{L})/gu, (_m, sep, ch) => sep + ch.toUpperCase()) : "");
const fmtBRL = (n?: number | string | null) => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || Number.isNaN(v)) return null;
  try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v); } catch { return `R$ ${v}`; }
};
function situacaoKey(s?: string | null): string {
  const S = (s ?? "").toUpperCase();
  if (S.includes("ATIVA")) return "ativa";
  if (S.includes("BAIXADA")) return "baixada";
  if (S.includes("INAPTA")) return "inapta";
  if (S.includes("SUSPENSA")) return "suspensa";
  if (S.includes("NULA")) return "nula";
  return "other";
}

interface Body { cnpjs?: string[]; mode?: "lookup" | "import"; }
interface BrasilApi {
  cnpj?: string; razao_social?: string; nome_fantasia?: string;
  descricao_situacao_cadastral?: string; data_inicio_atividade?: string;
  cnae_fiscal_descricao?: string; ddd_telefone_1?: string; ddd_telefone_2?: string; email?: string;
  logradouro?: string; numero?: string; bairro?: string; municipio?: string; uf?: string; cep?: string;
  porte?: string; capital_social?: number | string;
}
interface Mapped {
  cnpj: string; cnpjFmt: string; company: string; razao_social: string; nome_fantasia: string;
  phone: string | null; email: string | null; address: string | null; location: string | null;
  cnae: string | null; porte: string | null; abertura: string | null; capital: string | null;
  situacao: string; situacaoKey: string; nicheQuality: number; score: number;
}

async function fetchCnpj(cnpj: string): Promise<BrasilApi | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: ctrl.signal, headers: { "User-Agent": "maisLEAD-bot/1.0" } });
    clearTimeout(t);
    if (!r.ok) return null; // 404 = não encontrado / 400 = inválido
    return await r.json() as BrasilApi;
  } catch { return null; }
}

function mapCompany(cnpj: string, data: BrasilApi): Mapped | null {
  if (!data.razao_social && !data.nome_fantasia) return null;
  const razao = titleCase(data.razao_social) || titleCase(data.nome_fantasia);
  const fantasia = titleCase(data.nome_fantasia);
  const company = fantasia || razao;
  const phone = fmtPhone(data.ddd_telefone_1) ?? fmtPhone(data.ddd_telefone_2);
  const email = data.email && /.+@.+\..+/.test(data.email) ? data.email.toLowerCase() : null;
  const cnae = data.cnae_fiscal_descricao ? titleCase(data.cnae_fiscal_descricao) : null;
  const situacao = (data.descricao_situacao_cadastral ?? "").toUpperCase();
  const addrParts = [
    titleCase(data.logradouro) + (data.numero ? `, ${data.numero}` : ""),
    titleCase(data.bairro),
    [titleCase(data.municipio), (data.uf ?? "").toUpperCase()].filter(Boolean).join(" - "),
    onlyDigits(data.cep ?? "").replace(/^(\d{5})(\d{3})$/, "$1-$2"),
  ].filter((p) => p && p.trim() !== "" && p.trim() !== ",");
  const address = addrParts.join(", ") || null;
  const location = [titleCase(data.municipio), (data.uf ?? "").toUpperCase()].filter(Boolean).join("/") || null;
  const nicheQuality = situacao === "ATIVA" ? 6 : 3;
  return {
    cnpj, cnpjFmt: fmtCnpj(cnpj), company, razao_social: razao, nome_fantasia: fantasia,
    phone, email, address, location, cnae, porte: data.porte ? titleCase(data.porte) : null,
    abertura: data.data_inicio_atividade || null, capital: fmtBRL(data.capital_social),
    situacao, situacaoKey: situacaoKey(situacao), nicheQuality,
    score: scoreOf({ phone, address, email, website: null, nicheQuality }),
  };
}

// Consulta a BrasilAPI em pequenos lotes concorrentes.
async function fetchMany(cnpjs: string[]): Promise<{ cnpj: string; data: BrasilApi | null }[]> {
  const out: { cnpj: string; data: BrasilApi | null }[] = [];
  const CONC = 3;
  for (let i = 0; i < cnpjs.length; i += CONC) {
    const chunk = cnpjs.slice(i, i + CONC);
    const res = await Promise.all(chunk.map(async (c) => ({ cnpj: c, data: await fetchCnpj(c) })));
    out.push(...res);
  }
  return out;
}

const MAX = 50;

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

    // Conta + cota (reset mensal) + papel admin.
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

    const { cnpjs, mode = "lookup" }: Body = await req.json().catch(() => ({}));
    const raw = Array.isArray(cnpjs) ? cnpjs : [];
    const seen = new Set<string>();
    const clean: string[] = [];
    let invalid = 0;
    for (const c of raw) {
      const d = onlyDigits(c);
      if (d.length === 14 && isValidCnpj(d)) { if (!seen.has(d)) { seen.add(d); clean.push(d); } }
      else invalid++;
    }
    if (!clean.length) return json({ error: "missing_cnpj", invalid, quota: quota(count) }, 400);

    // Duplicados = CNPJ já existente na conta.
    const { data: existing } = await admin.from("leads").select("cnpj").eq("account_id", accountId).not("cnpj", "is", null);
    const seenCnpj = new Set((existing ?? []).map((e: { cnpj: string | null }) => onlyDigits(e.cnpj ?? "")).filter(Boolean));

    // ───── MODO LOOKUP (preview, não grava) ─────
    if (mode === "lookup") {
      const capped = clean.slice(0, MAX);
      const fetched = await fetchMany(capped);
      let notFound = 0;
      const results: (Mapped & { duplicate: boolean })[] = [];
      for (const { cnpj, data } of fetched) {
        const m = data ? mapCompany(cnpj, data) : null;
        if (!m) { notFound++; continue; }
        results.push({ ...m, duplicate: seenCnpj.has(cnpj) });
      }
      return json({ results, invalid, notFound, found: results.length, quota: quota(count) });
    }

    // ───── MODO IMPORT (grava selecionados, consome cota) ─────
    const targets = clean.filter((c) => !seenCnpj.has(c));
    const skippedDup = clean.length - targets.length;
    // Valida limite no backend (admin = ilimitado).
    if (!isAdmin && count + targets.length > cap) {
      return json({ error: "limit_reached", allowed: Math.max(0, cap - count), quota: quota(count) }, 402);
    }
    const fetched = await fetchMany(targets.slice(0, MAX));
    let notFound = 0;
    const rows: Record<string, unknown>[] = [];
    for (const { cnpj, data } of fetched) {
      const m = data ? mapCompany(cnpj, data) : null;
      if (!m) { notFound++; continue; }
      const notes = [
        `CNPJ: ${m.cnpjFmt}`,
        m.razao_social && m.nome_fantasia && m.razao_social !== m.nome_fantasia ? `Razão social: ${m.razao_social}` : "",
        m.situacao ? `Situação: ${m.situacao}` : "",
        m.porte ? `Porte: ${m.porte}` : "",
        m.capital ? `Capital social: ${m.capital}` : "",
      ].filter(Boolean).join("\n");
      rows.push({
        company_name: m.company, contact_name: null, industry: m.cnae, location: m.location,
        phone: m.phone, website: null, email: m.email, address: m.address, cnpj: m.cnpj,
        opening_date: m.abertura, notes,
        type: "cnpj", account_id: accountId, user_id: userId, source: "cnpj", status: "new",
        niche_quality: m.nicheQuality, score: m.score, extraction_date: new Date().toISOString(),
      });
    }

    let inserted: { id: string }[] = [];
    if (rows.length) {
      const { data, error } = await admin.from("leads").insert(rows).select("id");
      if (error) return json({ error: "insert_failed", message: error.message, quota: quota(count) }, 500);
      inserted = data ?? [];
      if (inserted.length) await admin.from("lead_events").insert(inserted.map((l) => ({ lead_id: l.id, account_id: accountId, type: "created", payload: { source: "cnpj" } })));
      count += inserted.length;
      await admin.from("accounts").update({ extraction_count_month: count }).eq("id", accountId);
    }
    await admin.from("searches").insert({ account_id: accountId, query: `${inserted.length} CNPJ`, location: null, source: "cnpj", count: inserted.length });

    return json({ inserted: inserted.length, skipped: skippedDup, notFound, invalid, quota: quota(count) });
  } catch (e) {
    return json({ error: "unexpected", message: String((e as Error).message ?? e) }, 500);
  }
});
