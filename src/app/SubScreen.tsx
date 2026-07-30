import { useState, useEffect, useRef } from "react";
import { useLang } from "./LangTheme";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Pricing, type PricingPlan } from "@/components/ui/pricing";

// Tela de Assinatura: escolhe plano (Free/Starter/Pro/Business), mensal ou anual, e abre
// o Checkout do Stripe (edge function stripe-checkout). Enquanto os secrets do Stripe
// não estão configurados, mostra uma mensagem amigável em vez de quebrar.
// Cotas espelham PLAN_CAPS (plan.ts / _shared/plans.ts): 100 / 500 / 2.500 / 6.000.

type PlanKey = "free" | "starter" | "pro" | "business";

const DICT = {
  pt: {
    title: "Escolha seu plano", sub: "Comece grátis. Faça upgrade quando precisar de mais volume.",
    monthly: "Mensal", annual: "Anual", save: "Economize 20%", perMo: "/mês", billedYear: "cobrado anualmente", billedMo: "cobrado mensalmente", annualBilling: "Cobrança anual",
    current: "Plano atual", subscribe: "Assinar", talk: "Falar com vendas", free: "Grátis",
    loading: "Abrindo checkout…", errCfg: "Pagamento ainda não está configurado. Tente novamente em breve.",
    errGen: "Não foi possível abrir o checkout agora. Tente de novo.",
    mostPopular: "Mais popular",
    plans: {
      free: { name: "Free", tag: "Para experimentar sem compromisso", feats: ["100 leads por mês", "Google Places + Empresas", "Pontuação de leads", "Dashboard e relatórios", "Exportação CSV"] },
      starter: { name: "Starter", tag: "Para quem está começando", feats: ["500 leads por mês", "Tudo do Free", "Verificação de dados", "CRM e agendamentos", "Suporte por e-mail"] },
      pro: { name: "Pro", tag: "Para times de vendas em crescimento", feats: ["2.500 leads por mês", "Tudo do Starter", "Enriquecimento de e-mails", "Detecção de tecnologia", "Integração com CRMs"] },
      business: { name: "Business", tag: "Para operações de alto volume", feats: ["6.000 leads por mês", "Tudo do Pro", "Pitch de IA (abordagem)", "Suporte prioritário"] },
    },
  },
  en: {
    title: "Choose your plan", sub: "Start free. Upgrade when you need more volume.",
    monthly: "Monthly", annual: "Annual", save: "Save 20%", perMo: "/mo", billedYear: "billed annually", billedMo: "billed monthly", annualBilling: "Annual billing",
    current: "Current plan", subscribe: "Subscribe", talk: "Talk to sales", free: "Free",
    loading: "Opening checkout…", errCfg: "Payment isn't configured yet. Please try again soon.",
    errGen: "Couldn't open checkout right now. Try again.",
    mostPopular: "Most popular",
    plans: {
      free: { name: "Free", tag: "To try it with no commitment", feats: ["100 leads per month", "Google Places + Companies", "Lead scoring", "Dashboard and reports", "CSV export"] },
      starter: { name: "Starter", tag: "For those getting started", feats: ["500 leads per month", "Everything in Free", "Data verification", "CRM and scheduling", "Email support"] },
      pro: { name: "Pro", tag: "For growing sales teams", feats: ["2,500 leads per month", "Everything in Starter", "Email enrichment", "Tech detection", "CRM integration"] },
      business: { name: "Business", tag: "For high-volume operations", feats: ["6,000 leads per month", "Everything in Pro", "AI pitch (outreach)", "Priority support"] },
    },
  },
  es: {
    title: "Elige tu plan", sub: "Empieza gratis. Mejora cuando necesites más volumen.",
    monthly: "Mensual", annual: "Anual", save: "Ahorra 20%", perMo: "/mes", billedYear: "cobrado anualmente", billedMo: "cobrado mensualmente", annualBilling: "Cobro anual",
    current: "Plan actual", subscribe: "Suscribirse", talk: "Hablar con ventas", free: "Gratis",
    loading: "Abriendo checkout…", errCfg: "El pago aún no está configurado. Inténtalo pronto.",
    errGen: "No se pudo abrir el checkout ahora. Inténtalo de nuevo.",
    mostPopular: "Más popular",
    plans: {
      free: { name: "Free", tag: "Para probar sin compromiso", feats: ["100 leads por mes", "Google Places + Empresas", "Puntuación de leads", "Panel e informes", "Exportación CSV"] },
      starter: { name: "Starter", tag: "Para quienes empiezan", feats: ["500 leads por mes", "Todo de Free", "Verificación de datos", "CRM y agendamientos", "Soporte por email"] },
      pro: { name: "Pro", tag: "Para equipos en crecimiento", feats: ["2.500 leads por mes", "Todo de Starter", "Enriquecimiento de emails", "Detección de tecnología", "Integración con CRMs"] },
      business: { name: "Business", tag: "Para alto volumen", feats: ["6.000 leads por mes", "Todo de Pro", "Pitch de IA (contacto)", "Soporte prioritario"] },
    },
  },
};

// preços de exibição (o valor real vem do price id no Stripe)
const PRICE: Record<PlanKey, { monthly: number; annual: number }> = {
  free: { monthly: 0, annual: 0 },
  starter: { monthly: 49, annual: 39 },
  pro: { monthly: 99, annual: 79 },
  business: { monthly: 229, annual: 199 },
};

export function SubScreen() {
  const { lang } = useLang();
  const { account } = useAuth();
  const D = DICT[lang];
  const current = (account?.plan ?? "free").toLowerCase() as PlanKey;
  const [annual, setAnnual] = useState(false);
  const [busy, setBusy] = useState<PlanKey | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Deep-link da landing: ?plan=pro|business&interval=monthly|annual → abre o checkout direto.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    try {
      const q = new URLSearchParams(window.location.search);
      const p = q.get("plan");
      const iv = q.get("interval") === "annual" ? "annual" : "monthly";
      if (iv === "annual") setAnnual(true);
      if (p === "starter" || p === "pro" || p === "business") {
        window.history.replaceState({}, "", window.location.pathname);
        subscribe(p as PlanKey, iv);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function subscribe(plan: PlanKey, intervalOverride?: "monthly" | "annual") {
    if (plan === "free" || busy) return;
    setBusy(plan); setErr(null);
    try {
      const interval = intervalOverride ?? (annual ? "annual" : "monthly");
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: { plan, interval, origin: window.location.origin },
      });
      let code: string | null = data?.error ?? null;
      if (error) {
        code = "err";
        try { const b = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); code = b?.error ?? code; } catch { /* ignore */ }
      }
      if (data?.url) { window.location.href = data.url; return; }
      setErr(code === "missing_api_key" || code === "missing_price" ? D.errCfg : D.errGen);
    } catch {
      setErr(D.errGen);
    } finally {
      setBusy(null);
    }
  }

  const order: PlanKey[] = ["free", "starter", "pro", "business"];

  const pricingPlans: PricingPlan[] = order.map((key) => {
    const p = D.plans[key];
    const isFree = key === "free";
    const isCurrent = current === key;
    return {
      key,
      name: p.name,
      price: PRICE[key].monthly,
      yearlyPrice: PRICE[key].annual,
      period: isFree ? "" : D.perMo,
      features: p.feats,
      description: p.tag,
      buttonText: busy === key ? D.loading : `${D.subscribe} ${p.name}`,
      isPopular: key === "pro",
      isCurrent,
      isFree,
    };
  });

  return (
    <div className="ml-fade" style={{ maxWidth: 1120, margin: "0 auto" }}>
      {err && <div style={{ textAlign: "center", color: "var(--ml-red)", fontSize: 13.5, marginBottom: 16 }}>{err}</div>}

      <Pricing
        plans={pricingPlans}
        title={D.title}
        description={D.sub}
        annual={annual}
        onAnnualChange={setAnnual}
        onSelect={(key) => subscribe(key as PlanKey)}
        busyKey={busy}
        locale={lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "pt-BR"}
        currency="BRL"
        labels={{
          monthly: D.monthly,
          annual: D.annual,
          save: D.save,
          billedMonthly: D.billedMo,
          billedAnnually: D.billedYear,
          popular: D.mostPopular,
          current: D.current,
          annualBilling: D.annualBilling,
          freeLabel: D.free,
        }}
      />
    </div>
  );
}
