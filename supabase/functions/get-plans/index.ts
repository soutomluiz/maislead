// Catálogo de planos — fonte única de verdade para a tela de cadastro e a de Assinatura.
// Lê os preços REAIS dos 4 price ids configurados no Stripe (mensal + anual de Pro/Business),
// calcula o desconto anual REAL (não fixo em 20%) e devolve nome/preço/features por plano.
// Público (sem auth) — só expõe dados de catálogo.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const PRICE_ENV: Record<string, string> = {
  "pro:monthly": "STRIPE_PRICE_PRO",
  "pro:annual": "STRIPE_PRICE_PRO_ANNUAL",
  "business:monthly": "STRIPE_PRICE_BUSINESS",
  "business:annual": "STRIPE_PRICE_BUSINESS_ANNUAL",
};

const NAMES: Record<string, string> = { starter: "Starter", pro: "Pro", business: "Business" };
const TAGS: Record<string, string> = {
  starter: "Para quem está começando",
  pro: "Para times de vendas em crescimento",
  business: "Para operações de alto volume",
};
// Features espelham as travas de plano do produto.
const FEATURES: Record<string, string[]> = {
  starter: ["50 leads por mês", "Google Maps + Empresas", "Pontuação de leads", "Dashboard e relatórios", "Exportação CSV"],
  pro: ["2.000 leads por mês", "Verificação de dados", "Enriquecimento de e-mails", "Detecção de tecnologia", "E-mail em massa + templates", "Integração com CRMs"],
  business: ["5.000 leads por mês", "Tudo do Pro", "Pitch de IA (abordagem)", "Enriquecimento por CNPJ", "Suporte prioritário"],
};

async function fetchPrice(sk: string, id: string | undefined) {
  if (!id) return null;
  try {
    const r = await fetch(`https://api.stripe.com/v1/prices/${id}`, { headers: { Authorization: `Bearer ${sk}` } });
    if (!r.ok) return null;
    const p = await r.json();
    return { amount: (p.unit_amount ?? 0) / 100, currency: (p.currency ?? "brl"), interval: p.recurring?.interval ?? null, id };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const sk = Deno.env.get("STRIPE_SECRET_KEY");
    if (!sk) return json({ error: "missing_api_key", message: "Configure o secret STRIPE_SECRET_KEY." }, 400);

    // deno-lint-ignore no-explicit-any
    const plans: Record<string, any> = {};
    plans.starter = { slug: "starter", name: NAMES.starter, tag: TAGS.starter, free: true, currency: "brl", monthly: 0, annualPerMonth: 0, annualTotal: 0, discountPct: 0, features: FEATURES.starter };

    for (const slug of ["pro", "business"]) {
      const m = await fetchPrice(sk, Deno.env.get(PRICE_ENV[`${slug}:monthly`] ?? ""));
      const y = await fetchPrice(sk, Deno.env.get(PRICE_ENV[`${slug}:annual`] ?? ""));
      const monthly = m?.amount ?? null;
      const annualTotal = y?.amount ?? null;
      const annualPerMonth = annualTotal != null ? Math.round(annualTotal / 12) : null;
      const discountPct = monthly && annualTotal ? Math.round(((monthly * 12 - annualTotal) / (monthly * 12)) * 100) : 0;
      plans[slug] = {
        slug, name: NAMES[slug], tag: TAGS[slug], free: false,
        currency: m?.currency ?? "brl",
        monthly, annualPerMonth, annualTotal, discountPct,
        priceMonthlyId: m?.id ?? null, priceAnnualId: y?.id ?? null,
        features: FEATURES[slug],
      };
    }

    return json({ plans });
  } catch (e) {
    return json({ error: "unexpected", message: String((e as Error).message ?? e) }, 500);
  }
});
