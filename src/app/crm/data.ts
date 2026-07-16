import { supabase } from "@/integrations/supabase/client";
import type { CrmStage, LeadRow } from "../leads/model";

// As tabelas/colunas novas (crm_stage, appointments, lead_documents/links/activities)
// ainda não estão nos tipos gerados do Supabase — alias local sem tipo forte.
const db = supabase as unknown as { from: (t: string) => any };

/* ----------------------- CRM: estágio do funil ----------------------- */
export async function setCrmStage(leadId: string, stage: CrmStage, accountId?: string | null) {
  const { error } = await db.from("leads").update({ crm_stage: stage }).eq("id", leadId);
  if (error) throw error;
  if (accountId) {
    await db.from("lead_events").insert({ lead_id: leadId, account_id: accountId, type: "stage_changed", payload: { stage } });
  }
}

/* ----------------------- Follow-up ----------------------- */
export async function setNextFollowUp(leadId: string, iso: string | null) {
  const { error } = await db.from("leads").update({ next_follow_up_at: iso }).eq("id", leadId);
  if (error) throw error;
}

/* ----------------------- Agendamentos ----------------------- */
export interface Appointment {
  id: string;
  lead_id: string | null;
  appt_date: string;         // YYYY-MM-DD
  appt_time: string | null;  // HH:MM
  notes: string | null;
  status: string;
  company: string | null;
}

export async function fetchAppointments(accountId: string): Promise<Appointment[]> {
  const { data, error } = await db
    .from("appointments")
    .select("id, lead_id, appt_date, appt_time, notes, status, leads(company_name)")
    .eq("account_id", accountId)
    .order("appt_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((a: any) => ({
    id: a.id, lead_id: a.lead_id, appt_date: a.appt_date, appt_time: a.appt_time,
    notes: a.notes, status: a.status, company: a.leads?.company_name ?? null,
  }));
}

export async function createAppointment(p: { accountId: string; leadId: string | null; date: string; time: string | null; notes: string | null }) {
  const { data, error } = await db.from("appointments").insert({
    account_id: p.accountId, lead_id: p.leadId, appt_date: p.date, appt_time: p.time || null, notes: p.notes || null,
  }).select("id").single();
  if (error) throw error;
  return data;
}

/* ----------------------- Documentos ----------------------- */
export interface LeadDoc { id: string; name: string; size: number | null; mime: string | null; path: string | null; created_at: string; }

export async function fetchDocuments(leadId: string): Promise<LeadDoc[]> {
  const { data, error } = await db
    .from("lead_documents").select("id, name, size, mime, path, created_at")
    .eq("lead_id", leadId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function uploadDocument(file: File, leadId: string, accountId: string): Promise<LeadDoc> {
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${accountId}/${leadId}/${crypto.randomUUID()}-${safe}`;
  const { error: upErr } = await supabase.storage.from("lead-docs").upload(path, file, { upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await db.from("lead_documents").insert({
    lead_id: leadId, account_id: accountId, name: file.name, size: file.size, mime: file.type || null, path,
  }).select("id, name, size, mime, path, created_at").single();
  if (error) throw error;
  return data;
}

export async function documentUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from("lead-docs").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export async function deleteDocument(id: string, path: string | null) {
  if (path) await supabase.storage.from("lead-docs").remove([path]);
  const { error } = await db.from("lead_documents").delete().eq("id", id);
  if (error) throw error;
}

/* ----------------------- Links ----------------------- */
export interface LeadLink { id: string; url: string; note: string | null; created_at: string; }

export function normalizeUrl(url: string): string {
  const u = url.trim();
  if (!u) return u;
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

export async function fetchLinks(leadId: string): Promise<LeadLink[]> {
  const { data, error } = await db
    .from("lead_links").select("id, url, note, created_at")
    .eq("lead_id", leadId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addLink(leadId: string, accountId: string, url: string, note: string | null): Promise<LeadLink> {
  const { data, error } = await db.from("lead_links").insert({
    lead_id: leadId, account_id: accountId, url: normalizeUrl(url), note: note?.trim() || null,
  }).select("id, url, note, created_at").single();
  if (error) throw error;
  return data;
}

export async function deleteLink(id: string) {
  const { error } = await db.from("lead_links").delete().eq("id", id);
  if (error) throw error;
}

/* ----------------------- Activities (histórico de follow-up) ----------------------- */
export type Channel = "whatsapp" | "call" | "email" | "meeting";
export interface Activity { id: string; channel: Channel; note: string | null; created_at: string; }

export async function fetchActivities(leadId: string): Promise<Activity[]> {
  const { data, error } = await db
    .from("lead_activities").select("id, channel, note, created_at")
    .eq("lead_id", leadId).order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addActivity(leadId: string, accountId: string, channel: Channel, note: string | null): Promise<Activity> {
  const { data, error } = await db.from("lead_activities").insert({
    lead_id: leadId, account_id: accountId, channel, note: note?.trim() || null,
  }).select("id, channel, note, created_at").single();
  if (error) throw error;
  return data;
}

export const CHANNEL_COLOR: Record<Channel, string> = {
  whatsapp: "#10b981", call: "#3b82f6", email: "#4c2ee0", meeting: "#f59e0b",
};

/* ----------------------- Funil de conversão ----------------------- */
export interface FunnelCounts { total: number; contacted: number; scheduled: number; followup: number; lost: number; won: number; }

// Deriva o funil dos leads + ids de leads com pelo menos 1 agendamento.
export function computeFunnel(leads: LeadRow[], scheduledLeadIds: Set<string>): FunnelCounts {
  const total = leads.length;
  let contacted = 0, followup = 0, lost = 0, won = 0;
  for (const l of leads) {
    if (l.crmStage !== "base") contacted++;
    if (l.crmStage === "followup") followup++;
    if (l.crmStage === "lost") lost++;
    if (l.crmStage === "won") won++;
  }
  const scheduled = leads.filter((l) => scheduledLeadIds.has(l.id)).length;
  return { total, contacted, scheduled, followup, lost, won };
}
