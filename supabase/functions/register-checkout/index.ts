// Cadastro + Checkout numa tacada: cria a conta (já confirmada) e devolve a URL do
// Stripe Checkout do price exato (plan+interval). Usado pela tela de cadastro da landing.
// O acesso ao app só é "pago" quando o webhook confirmar (accounts.plan). Público (sem JWT):
// é o endpoint de registro. Roda com service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const PRICE_ENV: Record<string, string> = {
  "pro:monthly": "STRIPE_PRICE_PRO",
  "pro:annual": "STRIPE_PRICE_PRO_ANNUAL",
  "business:monthly": "STRIPE_PRICE_BUSINESS",
  "business:annual": "STRIPE_PRICE_BUSINESS_ANNUAL",
};

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
function strongPassword(p: string): boolean {
  return p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && (/[0-9]/.test(p) || /[^A-Za-z0-9]/.test(p));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const SK = Deno.env.get("STRIPE_SECRET_KEY");
    if (!SK) return json({ error: "missing_api_key", message: "Configure o secret STRIPE_SECRET_KEY." }, 400);

    const { name, company, email, password, plan, interval, origin } = await req.json().catch(() => ({}));
    const mail = String(email ?? "").trim().toLowerCase();
    if (!mail || !EMAIL_RE.test(mail)) return json({ error: "invalid_email" }, 400);
    if (!strongPassword(String(password ?? ""))) return json({ error: "weak_password" }, 400);

    const iv = interval === "annual" || interval === "yearly" ? "annual" : "monthly";
    const envName = PRICE_ENV[`${plan}:${iv}`] ?? "";
    const priceId = Deno.env.get(envName);
    if (!priceId) return json({ error: "missing_price", message: `Configure o secret ${envName || "STRIPE_PRICE_*"}.` }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });

    // cria o usuário já confirmado (o trigger cria a conta + profile com account_id)
    const { data: created, error: ce } = await admin.auth.admin.createUser({
      email: mail,
      password: String(password),
      email_confirm: true,
      user_metadata: { full_name: String(name ?? "").trim() },
    });
    if (ce || !created?.user) {
      const msg = ce?.message ?? "";
      if (/registered|already|exists|duplicate/i.test(msg)) return json({ error: "email_exists" }, 409);
      return json({ error: "create_failed", message: msg }, 400);
    }
    const userId = created.user.id;

    // pega a conta criada pelo trigger; grava a empresa como nome da conta
    let accountId: string | null = null;
    for (let i = 0; i < 4 && !accountId; i++) {
      const { data: prof } = await admin.from("profiles").select("account_id").eq("id", userId).single();
      accountId = prof?.account_id ?? null;
      if (!accountId) await new Promise((r) => setTimeout(r, 200));
    }
    if (accountId && String(company ?? "").trim()) {
      await admin.from("accounts").update({ name: String(company).trim() }).eq("id", accountId);
    }

    // cria a Stripe Checkout Session do price exato
    const base = (origin || "https://app.maislead.com").replace(/\/$/, "");
    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("line_items[0][price]", priceId);
    params.set("line_items[0][quantity]", "1");
    params.set("success_url", `${base}/?checkout=success`);
    params.set("cancel_url", `${base}/?checkout=cancel`);
    params.set("client_reference_id", accountId ?? userId);
    params.set("metadata[account_id]", accountId ?? "");
    params.set("metadata[plan]", String(plan));
    params.set("metadata[interval]", iv);
    params.set("customer_email", mail);

    const r = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${SK}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const session = await r.json();
    if (!r.ok) return json({ error: "stripe_error", message: session?.error?.message ?? null }, 502);

    return json({ url: session.url });
  } catch (e) {
    return json({ error: "unexpected", message: String((e as Error).message ?? e) }, 500);
  }
});
