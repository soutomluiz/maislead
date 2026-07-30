"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Check, Star } from "lucide-react";
import confetti from "canvas-confetti";
import NumberFlow from "@number-flow/react";
import { useMediaQuery } from "@/hooks/use-media-query";

// Bloco de planos da maisLEAD — adaptado do component "Pricing" (shadcn/next) para o
// nosso stack (Vite) e identidade de marca (var(--ml-*), roxo #4c2ee0). Mantém as
// características do original: leque animado (framer-motion), confete ao trocar p/ anual,
// preço animado (NumberFlow) e selo "Popular" com estrela. É controlado: quem usa passa
// annual/onAnnualChange, onSelect e busyKey — a lógica de Stripe/i18n fica na tela.

export interface PricingPlan {
  key: string;
  name: string;
  /** preço mensal (número; 0 = plano grátis) */
  price: number;
  /** preço/mês quando cobrado anualmente */
  yearlyPrice: number;
  /** ex.: "/mês" — some quando free */
  period: string;
  features: string[];
  /** linha fina abaixo do botão */
  description: string;
  buttonText: string;
  isPopular: boolean;
  /** é o plano atual da conta? mostra estado "Plano atual" e desabilita */
  isCurrent?: boolean;
  /** plano grátis: mostra "Grátis" e não tem CTA de compra */
  isFree?: boolean;
}

export interface PricingLabels {
  monthly: string;
  annual: string;
  save: string;
  billedMonthly: string;
  billedAnnually: string;
  popular: string;
  current: string;
  annualBilling: string; // "Cobrança anual"
  freeLabel: string; // "Grátis"
}

interface PricingProps {
  plans: PricingPlan[];
  title?: string;
  description?: string;
  annual: boolean;
  onAnnualChange: (annual: boolean) => void;
  onSelect: (key: string) => void;
  busyKey?: string | null;
  labels: PricingLabels;
  /** locale p/ o NumberFlow (moeda). default pt-BR */
  locale?: string;
  currency?: string; // default BRL
}

const PRIMARY = "var(--ml-primary)";

export function Pricing({
  plans,
  title,
  description,
  annual,
  onAnnualChange,
  onSelect,
  busyKey,
  labels,
  locale = "pt-BR",
  currency = "BRL",
}: PricingProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const switchRef = useRef<HTMLButtonElement>(null);
  const count = plans.length;

  const fireConfetti = () => {
    const node = switchRef.current;
    const x = node ? (node.getBoundingClientRect().left + node.getBoundingClientRect().width / 2) / window.innerWidth : 0.5;
    const y = node ? (node.getBoundingClientRect().top + node.getBoundingClientRect().height / 2) / window.innerHeight : 0.3;
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { x, y },
      colors: ["#4c2ee0", "#6d4bff", "#a78bfa", "#10b981"],
      ticks: 200,
      gravity: 1.2,
      decay: 0.94,
      startVelocity: 30,
      shapes: ["circle"],
    });
  };

  const handleToggle = (checked: boolean) => {
    // checked = anual ligado
    onAnnualChange(checked);
    if (checked) fireConfetti();
  };

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "8px 0 12px" }}>
      {(title || description) && (
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          {title && (
            <h2 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: "-.025em", color: "var(--ml-text)" }}>{title}</h2>
          )}
          {description && (
            <p style={{ margin: "10px auto 0", maxWidth: 620, fontSize: 15, lineHeight: 1.55, color: "var(--ml-muted)", whiteSpace: "pre-line" }}>{description}</p>
          )}
        </div>
      )}

      {/* toggle mensal/anual */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginBottom: 30, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: annual ? "var(--ml-muted)" : "var(--ml-text)" }}>{labels.monthly}</span>
        <button
          ref={switchRef}
          role="switch"
          aria-checked={annual}
          aria-label={labels.annualBilling}
          onClick={() => handleToggle(!annual)}
          style={{ width: 46, height: 26, borderRadius: 20, border: "none", background: annual ? PRIMARY : "var(--ml-border)", position: "relative", cursor: "pointer", transition: ".2s", padding: 0, flexShrink: 0 }}
        >
          <span style={{ position: "absolute", top: 3, left: annual ? 23 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: ".2s", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
        </button>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: annual ? "var(--ml-text)" : "var(--ml-muted)" }}>
          {labels.annual} <span style={{ color: PRIMARY }}>({labels.save})</span>
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(auto-fit, minmax(250px, 1fr))`,
          gap: 16,
          alignItems: "stretch",
          justifyItems: "stretch",
        }}
      >
        {plans.map((plan, index) => {
          const isEdge = index === 0 || index === count - 1;
          const busy = busyKey === plan.key;
          const value = annual ? plan.yearlyPrice : plan.price;
          return (
            <motion.div
              key={plan.key}
              initial={{ y: 40, opacity: 0 }}
              whileInView={
                isDesktop
                  ? {
                      y: plan.isPopular ? -16 : 0,
                      opacity: 1,
                      scale: plan.isPopular ? 1.0 : isEdge ? 0.96 : 0.98,
                    }
                  : { y: 0, opacity: 1, scale: 1 }
              }
              viewport={{ once: true }}
              transition={{
                duration: 1.4,
                type: "spring",
                stiffness: 100,
                damping: 30,
                delay: 0.08 * index,
                opacity: { duration: 0.4 },
              }}
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                background: "var(--ml-card)",
                border: `${plan.isPopular ? 2 : 1.5}px solid ${plan.isPopular ? PRIMARY : "var(--ml-border)"}`,
                borderRadius: 20,
                padding: 26,
                textAlign: "center",
                boxShadow: plan.isPopular ? "0 16px 40px rgba(76,46,224,.16)" : "0 1px 3px rgba(30,25,60,.05)",
                zIndex: plan.isPopular ? 10 : 0,
              }}
            >
              {plan.isPopular && (
                <div style={{ position: "absolute", top: 0, right: 0, background: PRIMARY, padding: "4px 10px", borderTopRightRadius: 18, borderBottomLeftRadius: 14, display: "flex", alignItems: "center", gap: 4 }}>
                  <Star size={14} style={{ color: "#fff", fill: "currentColor" }} />
                  <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>{labels.popular}</span>
                </div>
              )}

              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: plan.isPopular ? PRIMARY : "var(--ml-muted)" }}>{plan.name}</p>

                <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 52 }}>
                  {plan.isFree ? (
                    <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-.02em", color: "var(--ml-text)" }}>{labels.freeLabel}</span>
                  ) : (
                    <>
                      <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: "-.02em", color: "var(--ml-text)", fontVariantNumeric: "tabular-nums" }}>
                        <NumberFlow
                          value={value}
                          locales={locale}
                          format={{ style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }}
                          transformTiming={{ duration: 500, easing: "ease-out" }}
                          willChange
                        />
                      </span>
                      {plan.period && (
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ml-muted)" }}>{plan.period}</span>
                      )}
                    </>
                  )}
                </div>

                <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ml-muted)", minHeight: 16 }}>
                  {plan.isFree ? "" : annual ? labels.billedAnnually : labels.billedMonthly}
                </p>

                <ul style={{ listStyle: "none", margin: "18px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 10, textAlign: "left" }}>
                  {plan.features.map((feature, idx) => (
                    <li key={idx} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: 13.5, color: "var(--ml-text)" }}>
                      <Check size={16} style={{ color: PRIMARY, marginTop: 2, flexShrink: 0 }} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <hr style={{ width: "100%", border: "none", borderTop: "1px solid var(--ml-border)", margin: "18px 0" }} />

                {plan.isCurrent ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", height: 46, borderRadius: 12, border: "1px solid var(--ml-border)", background: "var(--ml-bg)", color: "var(--ml-muted)", fontSize: 14, fontWeight: 700 }}>
                    <Check size={15} /> {labels.current}
                  </div>
                ) : plan.isFree ? (
                  <div style={{ height: 46 }} />
                ) : (
                  <button
                    onClick={() => onSelect(plan.key)}
                    disabled={busy}
                    style={{
                      width: "100%",
                      height: 46,
                      borderRadius: 12,
                      border: plan.isPopular ? "none" : `1px solid ${PRIMARY}`,
                      background: plan.isPopular ? PRIMARY : "transparent",
                      color: plan.isPopular ? "#fff" : PRIMARY,
                      fontSize: 15,
                      fontWeight: 700,
                      letterSpacing: "-.01em",
                      cursor: busy ? "default" : "pointer",
                      opacity: busy ? 0.7 : 1,
                      transition: "transform .2s, box-shadow .2s, background .2s",
                    }}
                    onMouseEnter={(e) => { if (!busy) { e.currentTarget.style.background = PRIMARY; e.currentTarget.style.color = "#fff"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(76,46,224,.28)"; } }}
                    onMouseLeave={(e) => { if (!busy) { e.currentTarget.style.background = plan.isPopular ? "var(--ml-primary)" : "transparent"; e.currentTarget.style.color = plan.isPopular ? "#fff" : "#4c2ee0"; e.currentTarget.style.boxShadow = "none"; } }}
                  >
                    {plan.buttonText}
                  </button>
                )}

                <p style={{ margin: "14px 0 0", fontSize: 12, lineHeight: 1.5, color: "var(--ml-muted)" }}>{plan.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
