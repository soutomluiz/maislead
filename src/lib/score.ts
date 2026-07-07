// Fórmula de pontuação de lead — DEVE ser idêntica em 3 lugares:
//  - protótipo (docs/maisLEAD.prototype.spec.html: scoreParts/scoreOf)
//  - banco (supabase function public.lead_score)
//  - front (este arquivo)
// Regra (README §3): 30 telefone + 15 endereço + 25 e-mail + 20 site + nicho(0–10), cap 100.

export interface ScoreInput {
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  website?: string | null;
  nicheQuality?: number | null; // nq 0..10
}

export interface ScoreBreakdown {
  phone: number;
  address: number;
  email: number;
  website: number;
  niche: number;
  total: number;
}

const has = (v?: string | null) => !!(v && v.trim() !== "" && v.trim() !== "—");

export function scoreParts(lead: ScoreInput): Omit<ScoreBreakdown, "total"> {
  return {
    phone: has(lead.phone) ? 30 : 0,
    address: has(lead.address) ? 15 : 0,
    email: has(lead.email) ? 25 : 0,
    website: has(lead.website) ? 20 : 0,
    niche: Math.max(0, Math.min(10, lead.nicheQuality ?? 0)),
  };
}

export function scoreOf(lead: ScoreInput): number {
  const p = scoreParts(lead);
  return Math.min(100, p.phone + p.address + p.email + p.website + p.niche);
}

export function scoreBreakdown(lead: ScoreInput): ScoreBreakdown {
  const p = scoreParts(lead);
  return { ...p, total: scoreOf(lead) };
}

// Temperatura (README §3): Quente >=75, Morno 55–74, Frio <55.
export type Temperature = "hot" | "warm" | "cool";

export function temperature(score: number): Temperature {
  if (score >= 75) return "hot";
  if (score >= 55) return "warm";
  return "cool";
}
