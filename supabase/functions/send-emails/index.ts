// E-mail em massa (README §8) via Resend. Substitui {{empresa}}/{{cidade}}/{{setor}} por lead.
// Feature de plano Pro/Business. Secrets: RESEND_API_KEY, RESEND_FROM (remetente verificado).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Cap diário de e-mails (não é a cota de leads — ver _shared/plans.ts).
// Recurso desativado até a v3; mantido aqui pra quando religar.
const DAILY_CAP: Record<string, number> = { free: 0, starter: 0, pro: 500, business: 5000 };

function fill(tpl: string, lead: { company_name?: string; location?: string; industry?: string }): string {
  return (tpl || "")
    .replace(/\{\{\s*empresa\s*\}\}/gi, lead.company_name ?? "")
    .replace(/\{\{\s*cidade\s*\}\}/gi, lead.location ?? "")
    .replace(/\{\{\s*setor\s*\}\}/gi, lead.industry ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    // Recurso de e-mail em massa DESATIVADO até a v3 (ver TODO.md). Código preservado.
    // Para religar: definir o secret EMAILS_ENABLED=true (+ RESEND_API_KEY e RESEND_FROM).
    if (Deno.env.get("EMAILS_ENABLED") !== "true") {
      return json({ error: "feature_disabled", message: "E-mail em massa está temporariamente desativado." }, 403);
    }
    const KEY = Deno.env.get("RESEND_API_KEY");
    if (!KEY) return json({ error: "missing_api_key", message: "Configure o secret RESEND_API_KEY (e RESEND_FROM)." }, 400);
    const FROM = Deno.env.get("RESEND_FROM") ?? "onboarding@resend.dev";

    const { subject, body, leadIds, templateId } = await req.json().catch(() => ({}));
    if (!subject?.trim() || !body?.trim()) return json({ error: "missing_content" }, 400);
    if (!Array.isArray(leadIds) || leadIds.length === 0) return json({ error: "no_recipients" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });
    const authTok = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authTok) return json({ error: "unauthorized" }, 401);
    const { data: u } = await admin.auth.getUser(authTok);
    if (!u?.user) return json({ error: "unauthorized" }, 401);
    const { data: prof } = await admin.from("profiles").select("account_id").eq("id", u.user.id).single();
    const accountId = prof?.account_id;
    if (!accountId) return json({ error: "no_account" }, 400);
    const { data: acc } = await admin.from("accounts").select("plan").eq("id", accountId).single();
    const plan = (acc?.plan ?? "starter").toLowerCase();
    const cap = DAILY_CAP[plan] ?? 0;
    if (cap <= 0) return json({ error: "feature_gated", message: "E-mail em massa está disponível nos planos Pro e Business." }, 402);

    const { data: leads } = await admin.from("leads").select("id, company_name, email, industry, location").eq("account_id", accountId).in("id", leadIds).limit(cap);
    const recipients = (leads ?? []).filter((l) => l.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(l.email));

    const { data: campaign } = await admin.from("email_campaigns").insert({
      account_id: accountId, template_id: templateId ?? null, recipient_lead_ids: recipients.map((r) => r.id),
      subject, body, status: "sending",
    }).select("id").single();

    let sent = 0; const events: any[] = [];
    for (const lead of recipients) {
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: FROM, to: lead.email, subject: fill(subject, lead), html: fill(body, lead).replace(/\n/g, "<br>") }),
        });
        if (r.ok) { sent++; events.push({ lead_id: lead.id, account_id: accountId, type: "email_sent", payload: { subject: fill(subject, lead), campaign_id: campaign?.id } }); }
      } catch { /* pula falha individual */ }
    }
    if (events.length) await admin.from("lead_events").insert(events);
    if (campaign?.id) await admin.from("email_campaigns").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", campaign.id);

    return json({ sent, skipped: recipients.length - sent, total: leadIds.length, noEmail: (leads ?? []).length - recipients.length });
  } catch (e) {
    return json({ error: "unexpected", message: String((e as Error).message ?? e) }, 500);
  }
});
