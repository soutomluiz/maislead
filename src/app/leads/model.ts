import type { Tables } from "@/integrations/supabase/types";
import { scoreOf, temperature, scoreBreakdown, type Temperature } from "@/lib/score";

export type DbLead = Tables<"leads">;
export type LeadStatus = "new" | "qualified" | "converted";

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
  };
}

export const STATUS_META: Record<LeadStatus, { color: string; bg: string }> = {
  new: { color: "var(--ml-primary)", bg: "rgba(109,92,245,.12)" },
  qualified: { color: "var(--ml-amber)", bg: "rgba(245,158,11,.14)" },
  converted: { color: "var(--ml-green)", bg: "rgba(16,185,129,.14)" },
};

export const TEMP_META: Record<Temperature, { color: string; bg: string }> = {
  hot: { color: "var(--ml-red)", bg: "rgba(239,68,68,.12)" },
  warm: { color: "var(--ml-amber)", bg: "rgba(245,158,11,.12)" },
  cool: { color: "var(--ml-primary)", bg: "rgba(109,92,245,.12)" },
};

export const hasVal = (v?: string | null) => !!(v && v.trim() !== "" && v.trim() !== "—");

// WhatsApp: só dígitos; adiciona 55 (BR) se parecer número nacional sem DDI.
export function waLink(phone: string, text: string): string {
  let d = phone.replace(/\D/g, "");
  if (d.length <= 11) d = "55" + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

export { scoreBreakdown, temperature };
