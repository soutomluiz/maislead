// Verificação/enriquecimento de lead (README §4) — sem chaves externas.
// E-mail: sintaxe + MX. Telefone: formato BR. Website: HTTP (no ar?). CNPJ (opcional): BrasilAPI (grátis).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/;

async function verifyEmail(email?: string | null): Promise<{ status: string }> {
  if (!email) return { status: "missing" };
  const m = email.trim().match(EMAIL_RE);
  if (!m) return { status: "invalid" };
  try {
    const mx = await Deno.resolveDns(m[1], "MX");
    return { status: mx && mx.length > 0 ? "valid" : "no_mx" };
  } catch { return { status: "no_mx" }; }
}

function verifyPhone(phone?: string | null): { status: string } {
  if (!phone) return { status: "missing" };
  const d = String(phone).replace(/\D/g, "").replace(/^0+/, "");
  const nat = d.startsWith("55") ? d.slice(2) : d;
  return { status: nat.length >= 10 && nat.length <= 11 ? "valid" : "invalid" };
}

async function verifyWebsite(website?: string | null): Promise<{ status: string }> {
  if (!website) return { status: "missing" };
  const url = website.startsWith("http") ? website : `https://${website}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    let r = await fetch(url, { method: "HEAD", signal: ctrl.signal, headers: { "User-Agent": "maisLEAD-bot" } });
    if (r.status >= 400) r = await fetch(url, { method: "GET", signal: ctrl.signal, headers: { "User-Agent": "maisLEAD-bot" } });
    return { status: r.status < 400 ? "online" : "offline" };
  } catch { return { status: "offline" }; }
  finally { clearTimeout(t); }
}

async function enrichCnpj(cnpj?: string | null): Promise<Record<string, unknown> | null> {
  if (!cnpj) return null;
  const d = String(cnpj).replace(/\D/g, "");
  if (d.length !== 14) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
    if (!r.ok) return null;
    const j = await r.json();
    return { razao_social: j.razao_social, nome_fantasia: j.nome_fantasia, situacao: j.descricao_situacao_cadastral, porte: j.porte, cnae: j.cnae_fiscal_descricao, municipio: j.municipio, uf: j.uf };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { leadId, cnpj } = await req.json().catch(() => ({}));
    if (!leadId) return json({ error: "missing_lead" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });
    const authTok = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authTok) return json({ error: "unauthorized" }, 401);
    const { data: u } = await admin.auth.getUser(authTok);
    if (!u?.user) return json({ error: "unauthorized" }, 401);
    const { data: prof } = await admin.from("profiles").select("account_id").eq("id", u.user.id).single();
    const accountId = prof?.account_id;
    if (!accountId) return json({ error: "no_account" }, 400);

    // gate: verificação de dados é Pro+
    const { data: gAcc } = await admin.from("accounts").select("plan").eq("id", accountId).single();
    const { data: gRoles } = await admin.from("user_roles").select("role").eq("user_id", u.user.id);
    const gIsAdmin = (gRoles ?? []).some((r: { role: string }) => r.role === "admin");
    const gTier = ({ free: 0, starter: 0, pro: 1, business: 2 } as Record<string, number>)[(gAcc?.plan ?? "starter").toLowerCase()] ?? 0;
    if (!gIsAdmin && gTier < 1) return json({ error: "feature_gated", message: "A verificação de dados está disponível nos planos Pro e Business." }, 402);

    const { data: lead } = await admin.from("leads").select("id, account_id, email, phone, website").eq("id", leadId).eq("account_id", accountId).single();
    if (!lead) return json({ error: "not_found" }, 404);

    const [email, website] = await Promise.all([verifyEmail(lead.email), verifyWebsite(lead.website)]);
    const phone = verifyPhone(lead.phone);
    const enrichment = await enrichCnpj(cnpj);

    const result = { email, phone, website, enrichment };
    await admin.from("lead_events").insert({ lead_id: lead.id, account_id: accountId, type: "verified", payload: result });

    return json(result);
  } catch (e) {
    return json({ error: "unexpected", message: String((e as Error).message ?? e) }, 500);
  }
});
