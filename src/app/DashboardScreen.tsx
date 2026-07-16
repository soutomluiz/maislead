import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLang } from "./LangTheme";
import { useAuth } from "./AuthContext";
import { Icon } from "./icons";
import { useLeads } from "./leads/useLeads";
import { LeadStatus, STATUS_META } from "./leads/model";
import { Card, Kpi, AreaChart, Donut, Bars, MONTHS, BAR_GRADIENTS } from "./charts";
import { FunnelCard } from "./crm/FunnelCard";
import { computeFunnel, fetchAppointments } from "./crm/data";

const DICT = {
  pt: { total: "Total de leads", recent: "Recentes", conv: "Taxa de conversão", email: "Com e-mail", phone: "Com telefone", website: "Com website", overTime: "Leads ao longo do tempo", byStatus: "Por status", bySource: "Por origem", byIndustry: "Por indústria", registered: "cadastrados", last30: "últimos 30 dias", ofContacts: "dos contatos", converted: "convertidos", noData: "Sem dados ainda", new: "Novo", qualified: "Qualificado", convertedS: "Convertido", google_maps: "Google Maps", website_src: "Websites", manual: "Manual", import: "Importado", leadsW: "Leads" },
  en: { total: "Total leads", recent: "Recent", conv: "Conversion rate", email: "With email", phone: "With phone", website: "With website", overTime: "Leads over time", byStatus: "By status", bySource: "By source", byIndustry: "By industry", registered: "registered", last30: "last 30 days", ofContacts: "of contacts", converted: "converted", noData: "No data yet", new: "New", qualified: "Qualified", convertedS: "Converted", google_maps: "Google Maps", website_src: "Websites", manual: "Manual", import: "Imported", leadsW: "Leads" },
  es: { total: "Total de leads", recent: "Recientes", conv: "Tasa de conversión", email: "Con email", phone: "Con teléfono", website: "Con sitio web", overTime: "Leads en el tiempo", byStatus: "Por estado", bySource: "Por origen", byIndustry: "Por industria", registered: "registrados", last30: "últimos 30 días", ofContacts: "de los contactos", converted: "convertidos", noData: "Sin datos aún", new: "Nuevo", qualified: "Calificado", convertedS: "Convertido", google_maps: "Google Maps", website_src: "Sitios web", manual: "Manual", import: "Importado", leadsW: "Leads" },
};

const nonEmpty = (v?: string | null) => typeof v === "string" && v.trim() !== "";

export function DashboardScreen() {
  const { lang } = useLang();
  const { account } = useAuth();
  const D = DICT[lang];
  const { leads, loading, error } = useLeads();

  // "Agendados" no funil = leads com pelo menos 1 agendamento.
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!account?.id) return;
    fetchAppointments(account.id)
      .then((appts) => setScheduledIds(new Set(appts.map((a) => a.lead_id).filter((id): id is string => !!id))))
      .catch(() => { /* ignore */ });
  }, [account?.id]);
  const funnel = useMemo(() => computeFunnel(leads, scheduledIds), [leads, scheduledIds]);

  const agg = useMemo(() => {
    const total = leads.length;
    const withEmail = leads.filter((l) => nonEmpty(l.email)).length;
    const withPhone = leads.filter((l) => nonEmpty(l.phone)).length;
    const withWebsite = leads.filter((l) => nonEmpty(l.website)).length;
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = leads.filter((l) => l.createdAt && new Date(l.createdAt).getTime() >= cutoff).length;
    const status: Record<LeadStatus, number> = { new: 0, qualified: 0, converted: 0 };
    const source: Record<string, number> = {};
    const industry: Record<string, number> = {};
    const month: Record<string, number> = {};
    for (const l of leads) {
      status[l.status] = (status[l.status] ?? 0) + 1;
      const src = l.source || "manual";
      source[src] = (source[src] ?? 0) + 1;
      if (l.industry) industry[l.industry] = (industry[l.industry] ?? 0) + 1;
      if (l.createdAt) { const m = l.createdAt.slice(0, 7); month[m] = (month[m] ?? 0) + 1; }
    }
    const conv = total ? Math.round((status.converted / total) * 1000) / 10 : 0;
    const industryTop = Object.entries(industry).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const sourceTop = Object.entries(source).sort((a, b) => b[1] - a[1]);
    const series = Object.entries(month).sort((a, b) => a[0].localeCompare(b[0]));
    return { total, withEmail, withPhone, withWebsite, recent, conv, status, sourceTop, industryTop, series };
  }, [leads]);

  if (loading) return <Center><Icon name="loader" size={26} className="ml-spin" style={{ color: "var(--ml-primary)" }} /></Center>;
  if (error) return <Center><span style={{ color: "var(--ml-red)", fontSize: 14 }}>{error}</span></Center>;

  const pct = (n: number) => (agg.total ? Math.round((n / agg.total) * 100) : 0);
  const accent = (n: number, color: string): ReactNode => (
    <><span style={{ color, fontWeight: 700 }}>{n}%</span> {D.ofContacts}</>
  );
  const convFmt = String(agg.conv).replace(".", lang === "en" ? "." : ",") + "%";

  return (
    <div className="ml-fade" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Funil de conversão (topo, acima dos KPIs) */}
      <FunnelCard counts={funnel} />

      {/* 6 KPIs — 3 colunas × 2 linhas (DESIGN-SPEC §3.1) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 18 }}>
        <Kpi label={D.total} value={String(agg.total)} sub={D.registered} icon="users" color="#4c2ee0" tint="rgba(76,46,224,.12)" />
        <Kpi label={D.recent} value={String(agg.recent)} sub={D.last30} icon="clock" color="#f59e0b" tint="rgba(245,158,11,.14)" />
        <Kpi label={D.conv} value={convFmt} sub={D.converted} icon="trendUp" color="#ec4899" tint="rgba(236,72,153,.13)" />
        <Kpi label={D.email} value={String(agg.withEmail)} sub={accent(pct(agg.withEmail), "#3b82f6")} icon="mail" color="#3b82f6" tint="rgba(59,130,246,.13)" />
        <Kpi label={D.phone} value={String(agg.withPhone)} sub={accent(pct(agg.withPhone), "#10b981")} icon="phone" color="#10b981" tint="rgba(16,185,129,.14)" />
        <Kpi label={D.website} value={String(agg.withWebsite)} sub={accent(pct(agg.withWebsite), "#4c2ee0")} icon="globe" color="#4c2ee0" tint="rgba(76,46,224,.12)" />
      </div>

      {/* Área + Donut */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)", gap: 18 }}>
        <Card title={D.overTime} titleGap={6}><AreaChart series={agg.series} labels={MONTHS[lang]} emptyText={D.noData} /></Card>
        <Card title={D.byStatus} titleGap={8}>
          <Donut total={agg.total} unitLabel={D.leadsW} emptyText={D.noData} segments={[
            { value: agg.status.new, color: STATUS_META.new.color, label: D.new },
            { value: agg.status.qualified, color: STATUS_META.qualified.color, label: D.qualified },
            { value: agg.status.converted, color: STATUS_META.converted.color, label: D.convertedS },
          ]} />
        </Card>
      </div>

      {/* Barras: origem + indústria */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 18 }}>
        <Card title={D.bySource}><Bars palette={BAR_GRADIENTS} emptyText={D.noData} rows={agg.sourceTop.map(([k, v]) => ({ label: (D as Record<string, string>)[`${k}_src`] || (D as Record<string, string>)[k] || k, value: v }))} /></Card>
        <Card title={D.byIndustry}><Bars palette={[BAR_GRADIENTS[0]]} emptyText={D.noData} rows={agg.industryTop.map(([k, v]) => ({ label: k, value: v }))} /></Card>
      </div>
    </div>
  );
}

function Center({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", placeItems: "center", minHeight: 300 }}>{children}</div>;
}
