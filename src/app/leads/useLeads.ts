import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { mapLead, LeadRow, LeadStatus } from "./model";

export function useLeads() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (error) setError(error.message);
    else { setError(null); setLeads((data ?? []).map(mapLead)); }
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { leads, loading, error, refetch };
}

// Muda status de 1+ leads e registra evento na timeline.
export async function updateLeadStatus(ids: string[], status: LeadStatus, accountId?: string | null) {
  const { error } = await supabase.from("leads").update({ status }).in("id", ids);
  if (error) throw error;
  if (accountId) {
    await supabase.from("lead_events").insert(
      ids.map((lead_id) => ({ lead_id, account_id: accountId, type: "status_changed", payload: { status } }))
    );
  }
}

export interface LeadNote { id: string; body: string; created_at: string; }

export async function fetchNotes(leadId: string): Promise<LeadNote[]> {
  const { data } = await supabase
    .from("lead_notes")
    .select("id, body, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function addNote(leadId: string, body: string, accountId?: string | null) {
  const { data: userRes } = await supabase.auth.getUser();
  const { error } = await supabase.from("lead_notes").insert({ lead_id: leadId, body, user_id: userRes.user?.id ?? null });
  if (error) throw error;
  if (accountId) {
    await supabase.from("lead_events").insert({ lead_id: leadId, account_id: accountId, type: "note_added", payload: { body } });
  }
}
