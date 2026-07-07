import { useMemo, type ReactNode } from "react";
import { useLang } from "./LangTheme";
import { Icon } from "./icons";
import { useLeads } from "./leads/useLeads";
import { LeadStatus, STATUS_META } from "./leads/model";
import { Card, Kpi, AreaChart, Donut, Bars, MONTHS } from "./charts";

const DICT = {
  pt: { total: "Total de leads", conv: "Taxa de conversão", email: "Com e-mail", phone: "Com telefone", overTime: "Leads ao longo do tempo", byStatus: "Por status", bySource: "Por origem", byIndustry: "Por indústria", ofLeads: "dos leads", noData: "Sem dados ainda", new: "Novo", qualified: "Qualificado", converted: "Convertido", google_maps: "Google Maps", website: "Websites", manual: "Manual", import: "Importado", leadsW: "leads" },
  en: { total: "Total leads", conv: "Conversion rate", email: "With email", phone: "With phone", overTime: "Leads over time", byStatus: "By status", bySource: "By source", byIndustry: "By industry", ofLeads: "of leads", noData: "No data yet", new: "New", qualified: "Qualified", converted: "Converted", google_maps: "Google Maps", website: "Websites", manual: "Manual", import: "Imported", leadsW: "leads" },
  es: { total: "Total de leads", conv: "Tasa de conversión", email: "Con email", phone: "Con teléfono", overTime: "Leads en el tiempo", byStatus: "Por estado", bySource: "Por origen", byIndustry: "Por industria", ofLeads: "de los leads", noData: "Sin datos aún", new: "Nuevo", qualified: "Calificado", converted: "Convertido", google_maps: "Google Maps", website: "Sitios web", manual: "Manual", import: "Importado", leadsW: "leads" },
};

const nonEmpty = (v?: string | null) => typeof v === "string" && v.trim() !== "";

export function DashboardScreen() {
  const { lang } = useLang();
  const D = DICT[lang];
  const { leads, loading, error } = useLeads();

  const agg = useMemo(() => {
    const total = leads.length;
    const withEmail = leads.filter((l) => nonEmpty(l.email)).length;
    const withPhone = leads.filter((l) => nonEmpty(l.phone)).length;
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
    return { total, withEmail, withPhone, conv, status, sourceTop, industryTop, series };
  }, [leads]);

  if (loading) return <Center><Icon name="loader" size={26} className="ml-spin" style={{ color: "var(--ml-primary)" }} /></Center>;
  if (error) return <Center><span style={{ color: "var(--ml-red)", fontSize: 14 }}>{error}</span></Center>;

  const pct = (n: number) => (agg.total ? Math.round((n / agg.total) * 100) + "% " + D.ofLeads : "");
  const palette = ["var(--ml-primary)", "var(--ml-blue)", "var(--ml-green)", "var(--ml-amber)", "var(--ml-red)", "var(--ml-navtext)"];

  return (
    <div className="ml-fade" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 16 }}>
        <Kpi label={D.total} value={String(agg.total)} icon="users" color="var(--ml-primary)" />
        <Kpi label={D.conv} value={agg.conv + "%"} icon="award" color="var(--ml-green)" />
        <Kpi label={D.email} value={String(agg.withEmail)} sub={pct(agg.withEmail)} icon="mail" color="var(--ml-blue)" />
        <Kpi label={D.phone} value={String(agg.withPhone)} sub={pct(agg.withPhone)} icon="phone" color="var(--ml-amber)" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        <Card title={D.overTime}><AreaChart series={agg.series} labels={MONTHS[lang]} emptyText={D.noData} /></Card>
        <Card title={D.byStatus}>
          <Donut total={agg.total} unitLabel={D.leadsW} emptyText={D.noData} segments={[
            { value: agg.status.new, color: STATUS_META.new.color, label: D.new },
            { value: agg.status.qualified, color: STATUS_META.qualified.color, label: D.qualified },
            { value: agg.status.converted, color: STATUS_META.converted.color, label: D.converted },
          ]} />
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title={D.bySource}><Bars total={agg.total} unit={D.leadsW} palette={palette} emptyText={D.noData} rows={agg.sourceTop.map(([k, v]) => ({ label: (D as Record<string, string>)[k] || k, value: v }))} /></Card>
        <Card title={D.byIndustry}><Bars total={agg.total} unit={D.leadsW} palette={palette} emptyText={D.noData} rows={agg.industryTop.map(([k, v]) => ({ label: k, value: v }))} /></Card>
      </div>
    </div>
  );
}

function Center({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", placeItems: "center", minHeight: 300 }}>{children}</div>;
}
