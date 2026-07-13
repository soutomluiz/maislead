import { useState, useEffect, useRef } from "react";
import { useLang } from "./LangTheme";
import { useAuth } from "./AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "./icons";

// Tela de Assinatura: escolhe plano (Free/Pro/Business), mensal ou anual, e abre o
// Checkout do Stripe (edge function stripe-checkout). Enquanto os secrets do Stripe
// não estão configurados, mostra uma mensagem amigável em vez de quebrar.

type PlanKey = "starter" | "pro" | "business";

const DICT = {
  pt: {
    title: "Escolha seu plano", sub: "Comece grátis. Faça upgrade quando precisar de mais volume.",
    monthly: "Mensal", annual: "Anual", save: "-20%", perMo: "/mês", billedYear: "cobrado anualmente",
    current: "Plano atual", subscribe: "Assinar", talk: "Falar com vendas", free: "Grátis",
    loading: "Abrindo checkout…", errCfg: "Pagamento ainda não está configurado. Tente novamente em breve.",
    errGen: "Não foi possível abrir o checkout agora. Tente de novo.",
    mostPopular: "Mais popular",
    plans: {
      starter: { name: "Starter", tag: "Para quem está começando", feats: ["50 leads por mês", "Google Places + Empresas", "Pontuação de leads", "Dashboard e relatórios", "Exportação CSV"] },
      pro: { name: "Pro", tag: "Para times de vendas em crescimento", feats: ["2.000 leads por mês", "Verificação de dados", "Enriquecimento de e-mails", "Detecção de tecnologia", "E-mail em massa + templates", "Integração com CRMs"] },
      business: { name: "Business", tag: "Para operações de alto volume", feats: ["5.000 leads por mês", "Tudo do Pro", "Pitch de IA (abordagem)", "Suporte prioritário"] },
    },
  },
  en: {
    title: "Choose your plan", sub: "Start free. Upgrade when you need more volume.",
    monthly: "Monthly", annual: "Annual", save: "-20%", perMo: "/mo", billedYear: "billed annually",
    current: "Current plan", subscribe: "Subscribe", talk: "Talk to sales", free: "Free",
    loading: "Opening checkout…", errCfg: "Payment isn't configured yet. Please try again soon.",
    errGen: "Couldn't open checkout right now. Try again.",
    mostPopular: "Most popular",
    plans: {
      starter: { name: "Starter", tag: "For those getting started", feats: ["50 leads per month", "Google Places + Companies", "Lead scoring", "Dashboard and reports", "CSV export"] },
      pro: { name: "Pro", tag: "For growing sales teams", feats: ["2,000 leads per month", "Data verification", "Email enrichment", "Tech detection", "Mass email + templates", "CRM integration"] },
      business: { name: "Business", tag: "For high-volume operations", feats: ["5,000 leads per month", "Everything in Pro", "AI pitch (outreach)", "Priority support"] },
    },
  },
  es: {
    title: "Elige tu plan", sub: "Empieza gratis. Mejora cuando necesites más volumen.",
    monthly: "Mensual", annual: "Anual", save: "-20%", perMo: "/mes", billedYear: "cobrado anualmente",
    current: "Plan actual", subscribe: "Suscribirse", talk: "Hablar con ventas", free: "Gratis",
    loading: "Abriendo checkout…", errCfg: "El pago aún no está configurado. Inténtalo pronto.",
    errGen: "No se pudo abrir el checkout ahora. Inténtalo de nuevo.",
    mostPopular: "Más popular",
    plans: {
      starter: { name: "Starter", tag: "Para quienes empiezan", feats: ["50 leads por mes", "Google Places + Empresas", "Puntuación de leads", "Panel e informes", "Exportación CSV"] },
      pro: { name: "Pro", tag: "Para equipos en crecimiento", feats: ["2.000 leads por mes", "Verificación de datos", "Enriquecimiento de emails", "Detección de tecnología", "Email masivo + plantillas", "Integración con CRMs"] },
      business: { name: "Business", tag: "Para alto volumen", feats: ["5.000 leads por mes", "Todo de Pro", "Pitch de IA (contacto)", "Soporte prioritario"] },
    },
  },
};

// preços de exibição (o valor real vem do price id no Stripe)
const PRICE: Record<PlanKey, { monthly: number; annual: number }> = {
  starter: { monthly: 0, annual: 0 },
  pro: { monthly: 99, annual: 79 },
  business: { monthly: 229, annual: 199 },
};

export function SubScreen() {
  const { lang } = useLang();
  const { account } = useAuth();
  const D = DICT[lang];
  const current = (account?.plan ?? "starter").toLowerCase() as PlanKey;
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
      if (p === "pro" || p === "business") {
        window.history.replaceState({}, "", window.location.pathname);
        subscribe(p as PlanKey, iv);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function subscribe(plan: PlanKey, intervalOverride?: "monthly" | "annual") {
    if (plan === "starter" || busy) return;
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

  const order: PlanKey[] = ["starter", "pro", "business"];

  return (
    <div className="ml-fade" style={{ maxWidth: 1040, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-.02em" }}>{D.title}</h2>
        <div style={{ fontSize: 14, color: "var(--ml-muted)", marginTop: 6 }}>{D.sub}</div>
      </div>

      {/* toggle mensal/anual */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, margin: "20px 0 26px" }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: annual ? "var(--ml-muted)" : "var(--ml-text)" }}>{D.monthly}</span>
        <button onClick={() => setAnnual((a) => !a)} aria-label="toggle" style={{ width: 46, height: 26, borderRadius: 20, border: "none", background: annual ? "var(--ml-primary)" : "var(--ml-border)", position: "relative", cursor: "pointer", transition: ".2s", padding: 0 }}>
          <span style={{ position: "absolute", top: 3, left: annual ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: ".2s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
        </button>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: annual ? "var(--ml-text)" : "var(--ml-muted)" }}>{D.annual}</span>
        <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--ml-green)", background: "rgba(16,185,129,.12)", padding: "3px 9px", borderRadius: 20 }}>{D.save}</span>
      </div>

      {err && <div style={{ textAlign: "center", color: "var(--ml-red)", fontSize: 13.5, marginBottom: 16 }}>{err}</div>}

      {/* cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 18, alignItems: "start" }}>
        {order.map((key) => {
          const p = D.plans[key];
          const price = annual ? PRICE[key].annual : PRICE[key].monthly;
          const isCurrent = current === key;
          const isPro = key === "pro";
          return (
            <div key={key} style={{ position: "relative", background: "var(--ml-card)", border: `1.5px solid ${isPro ? "var(--ml-primary)" : "var(--ml-border)"}`, borderRadius: 20, padding: 24, boxShadow: isPro ? "0 12px 32px rgba(109,92,245,.14)" : "0 1px 3px rgba(30,25,60,.04)" }}>
              {isPro && (
                <span style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", fontSize: 11, fontWeight: 800, color: "#fff", background: "var(--ml-primary)", padding: "4px 12px", borderRadius: 20, letterSpacing: ".04em", textTransform: "uppercase" }}>{D.mostPopular}</span>
              )}
              <div style={{ fontSize: 16, fontWeight: 800, color: isPro ? "var(--ml-primary)" : "var(--ml-text)" }}>{p.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--ml-muted)", marginTop: 3, minHeight: 34 }}>{p.tag}</div>

              <div style={{ margin: "14px 0 4px", display: "flex", alignItems: "baseline", gap: 4 }}>
                {price === 0 ? (
                  <span style={{ fontSize: 30, fontWeight: 800 }}>{D.free}</span>
                ) : (
                  <>
                    <span style={{ fontSize: 32, fontWeight: 800 }}>R${price}</span>
                    <span style={{ fontSize: 14, color: "var(--ml-muted)", fontWeight: 600 }}>{D.perMo}</span>
                  </>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ml-muted)", minHeight: 16 }}>{annual && price > 0 ? D.billedYear : ""}</div>

              {isCurrent ? (
                <div style={{ marginTop: 16, height: 44, borderRadius: 12, border: "1px solid var(--ml-border)", background: "var(--ml-bg)", color: "var(--ml-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13.5, fontWeight: 700, gap: 7 }}>
                  <Icon name="check" size={15} /> {D.current}
                </div>
              ) : key === "starter" ? (
                <div style={{ marginTop: 16, height: 44 }} />
              ) : (
                <button onClick={() => subscribe(key)} disabled={busy === key} style={{ marginTop: 16, width: "100%", height: 44, borderRadius: 12, border: isPro ? "none" : "1px solid var(--ml-primary)", background: isPro ? "var(--ml-primary)" : "transparent", color: isPro ? "#fff" : "var(--ml-primary)", fontSize: 14, fontWeight: 700, cursor: busy === key ? "default" : "pointer", opacity: busy === key ? 0.7 : 1 }}>
                  {busy === key ? D.loading : `${D.subscribe} ${p.name}`}
                </button>
              )}

              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 11 }}>
                {p.feats.map((f) => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13 }}>
                    <span style={{ color: "var(--ml-green)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="check" size={15} /></span>
                    <span style={{ color: "var(--ml-text)" }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
