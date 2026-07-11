import { useAuth } from "./AuthContext";

// Gating de features por plano. A trava REAL é no servidor (edge functions retornam
// feature_gated 402); aqui é a camada de UX: mostra cadeado e evita a chamada.
export type Feature = "verify" | "enrich" | "detectTech" | "massEmail" | "pitch";

const TIER: Record<string, number> = { free: 0, starter: 0, pro: 1, business: 2 };

// tier mínimo exigido por feature (1 = Pro, 2 = Business)
export const FEATURE_MIN: Record<Feature, number> = {
  verify: 1,
  enrich: 1,
  detectTech: 1,
  massEmail: 1,
  pitch: 2,
};

export function planTier(plan?: string | null): number {
  return TIER[(plan ?? "starter").toLowerCase()] ?? 0;
}

// nome do plano mínimo que libera a feature (para a mensagem de upsell)
export function minPlanLabel(feature: Feature): string {
  return FEATURE_MIN[feature] >= 2 ? "Business" : "Pro";
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
  const plan = (account?.plan ?? "starter").toLowerCase();
  const tier = planTier(plan);
  const can = (f: Feature) => tier >= FEATURE_MIN[f];
  return { plan, tier, can };
}
