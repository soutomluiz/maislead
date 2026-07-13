// Cria uma sessão de Checkout do Stripe para o plano escolhido (mensal ou anual).
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS,
//          STRIPE_PRICE_PRO_ANNUAL, STRIPE_PRICE_BUSINESS_ANNUAL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// (plano, intervalo) -> nome do secret com o price id
const PRICE_ENV: Record<string, string> = {
  "pro:monthly": "STRIPE_PRICE_PRO",
  "pro:annual": "STRIPE_PRICE_PRO_ANNUAL",
  "business:monthly": "STRIPE_PRICE_BUSINESS",
  "business:annual": "STRIPE_PRICE_BUSINESS_ANNUAL",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const SK = Deno.env.get("STRIPE_SECRET_KEY");
    if (!SK) return json({ error: "missing_api_key", message: "Configure o secret STRIPE_SECRET_KEY." }, 400);

    const { plan, interval, origin } = await req.json().catch(() => ({}));
    const iv = interval === "annual" ? "annual" : "monthly";
    const envName = PRICE_ENV[`${plan}:${iv}`] ?? "";
    const priceId = Deno.env.get(envName);
    if (!priceId) return json({ error: "missing_price", message: `Configure o secret ${envName || "STRIPE_PRICE_*"}.` }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });
    const authTok = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authTok) return json({ error: "unauthorized" }, 401);
    const { data: u } = await admin.auth.getUser(authTok);
    if (!u?.user) return json({ error: "unauthorized" }, 401);
    const email = u.user.email;
    const { data: prof } = await admin.from("profiles").select("account_id").eq("id", u.user.id).single();
    const accountId = prof?.account_id;
    if (!accountId) return json({ error: "no_account" }, 400);
    const { data: acc } = await admin.from("accounts").select("stripe_customer_id").eq("id", accountId).single();

    const base = (origin || "http://localhost:8080").replace(/\/$/, "");
    const params = new URLSearchParams();
    params.set("mode", "subscription");
    params.set("line_items[0][price]", priceId);
    params.set("line_items[0][quantity]", "1");
    params.set("success_url", `${base}/?checkout=success`);
    params.set("cancel_url", `${base}/?checkout=cancel`);
    params.set("client_reference_id", accountId);
    params.set("metadata[account_id]", accountId);
    params.set("metadata[plan]", plan);
    params.set("metadata[interval]", iv);
    if (acc?.stripe_customer_id) params.set("customer", acc.stripe_customer_id);
    else if (email) params.set("customer_email", email);

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
