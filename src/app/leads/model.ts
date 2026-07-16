import type { Tables } from "@/integrations/supabase/types";
import { scoreOf, temperature, scoreBreakdown, type Temperature } from "@/lib/score";

export type DbLead = Tables<"leads">;
export type LeadStatus = "new" | "qualified" | "converted";

// Estágios do funil de vendas (CRM Kanban). Coluna leads.crm_stage.
export type CrmStage = "base" | "contacted" | "scheduled" | "followup" | "won" | "lost";
export const CRM_STAGES: CrmStage[] = ["base", "contacted", "scheduled", "followup", "won"];
export const CRM_STAGE_COLOR: Record<CrmStage, string> = {
  base: "#94a3b8", contacted: "#3b82f6", scheduled: "#10b981", followup: "#f59e0b", won: "#4c2ee0", lost: "#ef4444",
};

// Tecnologia detectada no site (edge function detect-tech). Sinal de venda, não faz parte do score.
export interface TechInfo {
  cms: string | null;
  builder: string | null;
  ecommerce: string[];
  analytics: string[];
  pixels: string[];
  chat: string[];
  marketing: string[];
  framework: string[];
  has_pixel: boolean;
  has_analytics: boolean;
  is_ecommerce: boolean;
  checked_at?: string;
  ok?: boolean;
}

export interface LeadRow {
  id: string;
  company: string;
  contact: string | null;
  industry: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  status: LeadStatus;
  score: number;
  nicheQuality: number;
  temp: Temperature;
  createdAt: string | null;
  source: string | null;
  tags: string[];
  tech: TechInfo | null;
  rating: number | null;   // nota do Google Maps (0–5)
  reviews: number | null;  // nº de avaliações
  crmStage: CrmStage;      // estágio no funil (CRM Kanban)
  nextFollowUpAt: string | null; // próximo follow-up (relógio do card)
}

// "Reputação em risco" (Maps Audit grátis): tem nota e ela é baixa (<= 3.5).
export function reputationRisk(l: { rating: number | null }): boolean {
  return l.rating != null && l.rating <= 3.5;
}

export function mapLead(r: DbLead): LeadRow {
  const status = (["new", "qualified", "converted"].includes(r.status ?? "") ? r.status : "new") as LeadStatus;
  const score = r.score ?? scoreOf({ phone: r.phone, address: r.address, email: r.email, website: r.website, nicheQuality: r.niche_quality });
  return {
    id: r.id,
    company: r.company_name,
    contact: r.contact_name,
    industry: r.industry,
    location: r.location,
    phone: r.phone,
    email: r.email,
    website: r.website,
    address: r.address,
    status,
    score,
    nicheQuality: r.niche_quality ?? 0,
    temp: temperature(score),
    createdAt: r.created_at,
    source: r.source,
    tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
    tech: ((r as { tech?: TechInfo | null }).tech) ?? null,
    rating: r.rating != null ? Number(r.rating) : null,
    reviews: r.user_ratings_total ?? null,
    crmStage: (["base", "contacted", "scheduled", "followup", "won", "lost"].includes((r as { crm_stage?: string }).crm_stage ?? "")
      ? (r as { crm_stage?: string }).crm_stage : "base") as CrmStage,
    nextFollowUpAt: (r as { next_follow_up_at?: string | null }).next_follow_up_at ?? null,
  };
}

export const STATUS_META: Record<LeadStatus, { color: string; bg: string }> = {
  new: { color: "var(--ml-primary)", bg: "rgba(76,46,224,.12)" },
  qualified: { color: "var(--ml-amber)", bg: "rgba(245,158,11,.14)" },
  converted: { color: "var(--ml-green)", bg: "rgba(16,185,129,.14)" },
};

export const TEMP_META: Record<Temperature, { color: string; bg: string }> = {
  hot: { color: "var(--ml-red)", bg: "rgba(239,68,68,.12)" },
  warm: { color: "var(--ml-amber)", bg: "rgba(245,158,11,.12)" },
  cool: { color: "var(--ml-primary)", bg: "rgba(76,46,224,.12)" },
};

export const hasVal = (v?: string | null) => !!(v && v.trim() !== "" && v.trim() !== "—");

// WhatsApp: só dígitos; adiciona 55 (BR) se parecer número nacional sem DDI.
export function waLink(phone: string, text: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.length <= 11) d = "55" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

// tel: só dígitos (mantém + do DDI, se houver).
export function telLink(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

// Substitui as variáveis do template de mensagem.
// {empresa} = nome do lead contatado · {minhaEmpresa} = empresa do usuário logado.
export function fillTemplate(tpl: string, vars: { empresa?: string | null; minhaEmpresa?: string | null; setor?: string | null; cidade?: string | null }): string {
  return (tpl ?? "")
    .split("{minhaEmpresa}").join(vars.minhaEmpresa ?? "")
    .split("{empresa}").join(vars.empresa ?? "")
    .split("{setor}").join(vars.setor ?? "")
    .split("{cidade}").join(vars.cidade ?? "");
}

// Status do relógio de follow-up a partir de next_follow_up_at (compara só a data).
export type FollowState = "late" | "today" | "future";
export interface FollowInfo { has: boolean; state: FollowState; days: number; }
export function followInfo(value: string | null): FollowInfo {
  if (!value) return { has: false, state: "future", days: 0 };
  const [y, m, d] = value.slice(0, 10).split("-").map(Number); // aceita 'YYYY-MM-DD' e ISO completo
  if (!y || !m || !d) return { has: false, state: "future", days: 0 };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(y, m - 1, d); // data local (sem fuso)
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { has: true, state: "late", days: -diff };
  if (diff === 0) return { has: true, state: "today", days: 0 };
  return { has: true, state: "future", days: diff };
}

// Cores do relógio (idênticas ao protótipo): atrasado=vermelho(pulsa), hoje=amarelo, futuro=roxo.
export const FOLLOW_META: Record<FollowState, { color: string; bg: string; pulse: boolean }> = {
  late: { color: "#ef4444", bg: "rgba(239,68,68,.12)", pulse: true },
  today: { color: "#f59e0b", bg: "rgba(245,158,11,.13)", pulse: false },
  future: { color: "#4c2ee0", bg: "rgba(76,46,224,.12)", pulse: false },
};

export { scoreBreakdown, temperature };
