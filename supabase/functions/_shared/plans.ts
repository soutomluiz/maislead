// Fonte ÚNICA de verdade dos planos no backend.
// Antes isso vivia duplicado em 5+ edge functions; agora todas importam daqui.
// Ao mudar um limite, alterar SÓ este arquivo e redeployar as functions que o usam.
//
// Tabela de planos (2026-07-23):
//   free      grátis     100 leads/mês
//   starter   R$ 49      500 leads/mês
//   pro       R$ 99    2.500 leads/mês
//   business  R$ 229   6.000 leads/mês

export type PlanSlug = "free" | "starter" | "pro" | "business";

export const PLAN_SLUGS: PlanSlug[] = ["free", "starter", "pro", "business"];

/** Cota mensal de leads por plano. */
export const PLAN_CAPS: Record<string, number> = {
  free: 100,
  starter: 500,
  pro: 2500,
  business: 6000,
};

/** Preço mensal em BRL (exibição/relatórios; o valor cobrado vem do Stripe). */
export const PLAN_PRICE: Record<string, number> = {
  free: 0,
  starter: 49,
  pro: 99,
  business: 229,
};

/** Rótulo de exibição. */
export const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

/**
 * Tier para gating de features (maior = mais liberado).
 * free 0 · starter 1 · pro 2 · business 3
 * Starter é pago e libera a Verificação de dados (tier 1); Enriquecimento e
 * Detecção de tecnologia exigem Pro (2); Pitch de IA exige Business (3).
 */
export const PLAN_TIER: Record<string, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
};

/** Tier mínimo por feature — espelha src/app/plan.ts no frontend. */
export const FEATURE_MIN = {
  verify: 1,
  enrich: 2,
  detectTech: 2,
  pitch: 3,
} as const;

const norm = (p?: string | null) => (p ?? "free").toLowerCase();

/** Cota do plano (fallback: free). */
export const planCap = (p?: string | null): number => PLAN_CAPS[norm(p)] ?? PLAN_CAPS.free;

/** Tier do plano (fallback: free = 0). */
export const planTier = (p?: string | null): number => PLAN_TIER[norm(p)] ?? 0;

/** Se o plano libera a feature. */
export const planAllows = (p: string | null | undefined, feature: keyof typeof FEATURE_MIN): boolean =>
  planTier(p) >= FEATURE_MIN[feature];
