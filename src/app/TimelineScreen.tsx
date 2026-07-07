import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "./LangTheme";
import { Icon, IconName } from "./icons";

interface EventRow {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
  company: string;
  phone: string | null;
  website: string | null;
}

const DICT = {
  pt: { created: "Lead adicionado ao sistema", statusTo: "Status alterado para", noteAdded: "Nota adicionada", verified: "Dados verificados", emailSent: "E-mail enviado", tagAdded: "Tag adicionada", empty: "Nenhuma atividade ainda", statusNew: "Novo", statusQualified: "Qualificado", statusConverted: "Convertido" },
  en: { created: "Lead added to the system", statusTo: "Status changed to", noteAdded: "Note added", verified: "Data verified", emailSent: "Email sent", tagAdded: "Tag added", empty: "No activity yet", statusNew: "New", statusQualified: "Qualified", statusConverted: "Converted" },
  es: { created: "Lead añadido al sistema", statusTo: "Estado cambiado a", noteAdded: "Nota añadida", verified: "Datos verificados", emailSent: "Email enviado", tagAdded: "Etiqueta añadida", empty: "Sin actividad aún", statusNew: "Nuevo", statusQualified: "Calificado", statusConverted: "Convertido" },
};

const META: Record<string, { icon: IconName; color: string; bg: string }> = {
  created: { icon: "plus", color: "var(--ml-primary)", bg: "rgba(109,92,245,.12)" },
  status_changed: { icon: "check", color: "var(--ml-amber)", bg: "rgba(245,158,11,.14)" },
  note_added: { icon: "award", color: "var(--ml-green)", bg: "rgba(16,185,129,.14)" },
  verified: { icon: "check", color: "var(--ml-blue)", bg: "rgba(59,130,246,.14)" },
  email_sent: { icon: "mail", color: "var(--ml-primary)", bg: "rgba(109,92,245,.12)" },
};

const domain = (w?: string | null) => { if (!w) return null; try { return new URL(w.startsWith("http") ? w : `https://${w}`).hostname.replace(/^www\./, ""); } catch { return w; } };

export function TimelineScreen() {
  const { lang } = useLang();
  const D = DICT[lang];
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("lead_events")
        .select("id, type, payload, created_at, leads(company_name, phone, website)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (!mounted) return;
      const rows: EventRow[] = (data ?? []).map((e) => {
        const lead = e.leads as unknown as { company_name?: string; phone?: string; website?: string } | null;
        return { id: e.id, type: e.type, payload: (e.payload as Record<string, unknown>) ?? null, created_at: e.created_at, company: lead?.company_name ?? "—", phone: lead?.phone ?? null, website: lead?.website ?? null };
      });
      setEvents(rows);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const statusLabel = (s: unknown) => s === "qualified" ? D.statusQualified : s === "converted" ? D.statusConverted : D.statusNew;
  const detail = (e: EventRow): string => {
    if (e.type === "status_changed") return `${D.statusTo} ${statusLabel(e.payload?.status)}`;
    if (e.type === "note_added") return D.noteAdded;
    if (e.type === "verified") return D.verified;
    if (e.type === "email_sent") return D.emailSent;
    return D.created;
  };

  if (loading) return <Center><Icon name="loader" size={26} className="ml-spin" style={{ color: "var(--ml-primary)" }} /></Center>;
  if (events.length === 0) return <Center><span style={{ color: "var(--ml-muted)" }}>{D.empty}</span></Center>;

  return (
    <div className="ml-fade" style={{ maxWidth: 820 }}>
      <div style={{ position: "relative" }}>
        {events.map((e, idx) => {
          const m = META[e.type] ?? META.created;
          const dom = domain(e.website);
          const last = idx === events.length - 1;
          return (
            <div key={e.id} style={{ display: "flex", gap: 16, paddingBottom: last ? 0 : 16 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: m.bg, color: m.color, flexShrink: 0 }}><Icon name={m.icon} size={18} /></span>
                {!last && <span style={{ flex: 1, width: 2, background: "var(--ml-border)", marginTop: 6, marginBottom: -16 }} />}
              </div>
              <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 16, padding: "16px 18px", flex: 1, boxShadow: "0 1px 3px rgba(30,25,60,.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700 }}>{e.company}</div>
                    <div style={{ fontSize: 13, color: "var(--ml-muted)", marginTop: 2 }}>{detail(e)}</div>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--ml-muted)", whiteSpace: "nowrap", flexShrink: 0 }}>{new Date(e.created_at).toLocaleString(lang === "pt" ? "pt-BR" : lang === "es" ? "es-ES" : "en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                {(e.phone || dom) && (
                  <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12.5, color: "var(--ml-muted)" }}>
                    {e.phone && <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="phone" size={13} />{e.phone}</span>}
                    {dom && <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="globe" size={13} />{dom}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Center({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", placeItems: "center", minHeight: 260 }}>{children}</div>;
}
