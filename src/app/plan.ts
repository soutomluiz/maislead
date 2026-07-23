import { useAuth } from "./AuthContext";

// Gating de features por plano. A trava REAL é no servidor (edge functions retornam
// feature_gated 402); aqui é a camada de UX: mostra cadeado e evita a chamada.
// Espelha supabase/functions/_shared/plans.ts — manter os dois em sincronia.
// massEmail (e-mail em massa) removido do gating até a v3 — ver TODO.md.
export type Feature = "verify" | "enrich" | "detectTech" | "pitch";

// free 0 · starter 1 (pago) · pro 2 · business 3
const TIER: Record<string, number> = { free: 0, starter: 1, pro: 2, business: 3 };

// tier mínimo exigido por feature (1 = Starter, 2 = Pro, 3 = Business)
export const FEATURE_MIN: Record<Feature, number> = {
  verify: 1,
  enrich: 2,
  detectTech: 2,
  pitch: 3,
};

// cota mensal de leads por plano (espelha PLAN_CAPS do backend)
export const PLAN_CAPS: Record<string, number> = {
  free: 100,
  starter: 500,
  pro: 2500,
  business: 6000,
};

export const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

export function planTier(plan?: string | null): number {
  return TIER[(plan ?? "free").toLowerCase()] ?? 0;
}

export function planCap(plan?: string | null): number {
  return PLAN_CAPS[(plan ?? "free").toLowerCase()] ?? PLAN_CAPS.free;
}

export function planLabel(plan?: string | null): string {
  const k = (plan ?? "free").toLowerCase();
  return PLAN_LABEL[k] ?? (k.charAt(0).toUpperCase() + k.slice(1));
}

// nome do plano mínimo que libera a feature (para a mensagem de upsell)
export function minPlanLabel(feature: Feature): string {
  const min = FEATURE_MIN[feature];
  return min >= 3 ? "Business" : min >= 2 ? "Pro" : "Starter";
}

const UPSELL = {
  pt: (f: Feature) => `Recurso do plano ${minPlanLabel(f)}. Faça upgrade em Assinatura para liberar.`,
  en: (f: Feature) => `${minPlanLabel(f)} plan feature. Upgrade in Subscription to unlock.`,
  es: (f: Feature) => `Función del plan ${minPlanLabel(f)}. Mejora en Suscripción para desbloquear.`,
};

export function upsellText(feature: Feature, lang: "pt" | "en" | "es"): string {
  return (UPSELL[lang] ?? UPSELL.pt)(feature);
}

// hook: lê o plano da conta e diz o que pode/não pode
export function usePlan() {
  const { account } = useAuth();
  const plan = (account?.plan ?? "free").toLowerCase();
  const tier = planTier(plan);
  const can = (f: Feature) => tier >= FEATURE_MIN[f];
  // cota do mês: usado / limite (null = ilimitado não se aplica aqui, admin é tratado no backend)
  const used = account?.extraction_count_month ?? 0;
  const cap = planCap(plan);
  return { plan, tier, can, used, cap, remaining: Math.max(0, cap - used), label: planLabel(plan) };
}
