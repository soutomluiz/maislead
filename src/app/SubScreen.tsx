import { useState, useEffect, useRef } from "react";
import { useLang } from "./LangTheme";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Pricing, type PricingPlan } from "@/components/ui/pricing";
import plansData from "@/config/plans.json";

// Tela de Assinatura: escolhe plano (Free/Starter/Pro/Business), mensal ou anual, e abre
// o Checkout do Stripe (edge function stripe-checkout). Enquanto os secrets do Stripe
// não estão configurados, mostra uma mensagem amigável em vez de quebrar.
//
// FONTE ÚNICA dos planos: src/config/plans.json (mesmo arquivo que a landing consome via
// app.maislead.com/plans.json). Preço/feature/cópia editam-se SÓ lá. Aqui ficam apenas as
// strings específicas desta tela (checkout/erros) e a lógica de assinatura.

type PlanKey = "free" | "starter" | "pro" | "business";

const APP = {
  pt: { current: "Plano atual", loading: "Abrindo checkout…", errCfg: "Pagamento ainda não está configurado. Tente novamente em breve.", errGen: "Não foi possível abrir o checkout agora. Tente de novo." },
  en: { current: "Current plan", loading: "Opening checkout…", errCfg: "Payment isn't configured yet. Please try again soon.", errGen: "Couldn't open checkout right now. Try again." },
  es: { current: "Plan actual", loading: "Abriendo checkout…", errCfg: "El pago aún no está configurado. Inténtalo pronto.", errGen: "No se pudo abrir el checkout ahora. Inténtalo de nuevo." },
};

const PRICES = plansData.prices as Record<PlanKey, { monthly: number; annual: number }>;
const ORDER = plansData.order as PlanKey[];
const POPULAR = plansData.popular as PlanKey;

export function SubScreen() {
  const { lang } = useLang();
  const { account } = useAuth();
  const A = APP[lang];
  const T = plansData.i18n[lang];
  const L = T.labels;
  const current = (account?.plan ?? "free").toLowerCase() as PlanKey;
  const [annual, setAnnual] = useState(false);
  const [busy, setBusy] = useState<PlanKey | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Deep-link da landing: ?plan=starter|pro|business&interval=monthly|annual → abre o checkout direto.
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
      setErr(code === "missing_api_key" || code === "missing_price" ? A.errCfg : A.errGen);
    } catch {
      setErr(A.errGen);
    } finally {
      setBusy(null);
    }
  }

  const pricingPlans: PricingPlan[] = ORDER.map((key) => {
    const p = T.plans[key];
    const isFree = key === "free";
    return {
      key,
      name: p.name,
      price: PRICES[key].monthly,
      yearlyPrice: PRICES[key].annual,
      period: isFree ? "" : L.perMo,
      features: p.feats,
      description: p.tag,
      buttonText: busy === key ? A.loading : p.cta,
      isPopular: key === POPULAR,
      isCurrent: current === key,
      isFree,
    };
  });

  return (
    <div className="ml-fade" style={{ maxWidth: 1120, margin: "0 auto" }}>
      {err && <div style={{ textAlign: "center", color: "var(--ml-red)", fontSize: 13.5, marginBottom: 16 }}>{err}</div>}

      <Pricing
        plans={pricingPlans}
        title={L.title}
        description={L.sub}
        annual={annual}
        onAnnualChange={setAnnual}
        onSelect={(key) => subscribe(key as PlanKey)}
        busyKey={busy}
        locale={lang === "en" ? "en-US" : lang === "es" ? "es-ES" : "pt-BR"}
        currency="BRL"
        labels={{
          monthly: L.monthly,
          annual: L.annual,
          save: L.save,
          billedMonthly: L.billedMo,
          billedAnnually: L.billedYear,
          popular: L.popular,
          current: A.current,
          annualBilling: L.annualBilling,
          freeLabel: L.free,
        }}
      />
    </div>
  );
}
