// Webhook do Stripe: atualiza accounts.plan + stripe ids ao concluir checkout / mudar assinatura.
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.  Requer verify_jwt = false.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const admin = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });

// Verificação da assinatura do Stripe (HMAC-SHA256) sem SDK.
async function verify(payload: string, sig: string | null, secret: string): Promise<boolean> {
  if (!sig) return false;
  const parts = Object.fromEntries(sig.split(",").map((kv) => kv.split("=")));
  const t = parts["t"]; const v1 = parts["v1"];
  if (!t || !v1) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === v1;
}

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!secret) return new Response("missing STRIPE_WEBHOOK_SECRET", { status: 400 });
    const payload = await req.text();
    const ok = await verify(payload, req.headers.get("stripe-signature"), secret);
    if (!ok) return new Response("bad signature", { status: 400 });

    const event = JSON.parse(payload);
    const db = admin();
    const obj = event.data?.object ?? {};

    if (event.type === "checkout.session.completed") {
      const accountId = obj.client_reference_id ?? obj.metadata?.account_id;
      const plan = obj.metadata?.plan ?? "pro";
      if (accountId) {
        await db.from("accounts").update({
          plan, stripe_customer_id: obj.customer ?? null, stripe_subscription_id: obj.subscription ?? null,
        }).eq("id", accountId);
      }
    } else if (event.type === "customer.subscription.deleted") {
      if (obj.customer) await db.from("accounts").update({ plan: "starter", stripe_subscription_id: null }).eq("stripe_customer_id", obj.customer);
    } else if (event.type === "customer.subscription.updated") {
      const status = obj.status;
      if (obj.customer && (status === "canceled" || status === "unpaid")) {
        await db.from("accounts").update({ plan: "starter" }).eq("stripe_customer_id", obj.customer);
      }
    }
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(String((e as Error).message ?? e), { status: 500 });
  }
});
