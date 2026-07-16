import { useMemo, useState, type ReactNode } from "react";
import { useLang } from "./LangTheme";
import { Icon, type IconName } from "./icons";
import { useLeads } from "./leads/useLeads";
import { LeadStatus, STATUS_META, TEMP_META } from "./leads/model";
import { Card, Kpi, AreaChart, Bars, MONTHS } from "./charts";

type Tab = "funnel" | "source" | "score" | "industry" | "time";
type Period = "all" | "7" | "30" | "90" | "365";

const DICT = {
  pt: { funnel: "Funil", source: "Origem", score: "Pontuação", industry: "Indústria", time: "No tempo",
    all: "Tudo", d7: "7 dias", d30: "30 dias", d90: "90 dias", y1: "1 ano",
    new: "Novo", qualified: "Qualificado", converted: "Convertido", hot: "Quente", warm: "Morno", cool: "Frio",
    total: "Total", conv: "Conversão", passthrough: "de passagem", actionable: "Acionáveis", avgScore: "Score médio",
    google_maps: "Google Maps", website: "Websites", manual: "Manual", import: "Importado", leadsW: "leads", noData: "Sem dados no período",
    funnelT: "Funil de conversão", sourceT: "Conversão por origem", scoreT: "Distribuição de pontuação", industryT: "Por indústria", timeT: "Leads ao longo do tempo",
    totalPeriod: "Total no período", daysToConv: "Dias até conversão", export: "Exportar CSV", last7: "Últimos 7 dias", last30: "Últimos 30 dias", last90: "Últimos 90 dias", lastYear: "Último ano", funnelSub: "Do lead novo até o cliente convertido." },
  en: { funnel: "Funnel", source: "Source", score: "Scoring", industry: "Industry", time: "Over time",
    all: "All", d7: "7 days", d30: "30 days", d90: "90 days", y1: "1 year",
    new: "New", qualified: "Qualified", converted: "Converted", hot: "Hot", warm: "Warm", cool: "Cool",
    total: "Total", conv: "Conversion", passthrough: "pass-through", actionable: "Actionable", avgScore: "Avg score",
    google_maps: "Google Maps", website: "Websites", manual: "Manual", import: "Imported", leadsW: "leads", noData: "No data in period",
    funnelT: "Conversion funnel", sourceT: "Conversion by source", scoreT: "Score distribution", industryT: "By industry", timeT: "Leads over time",
    totalPeriod: "Total in period", daysToConv: "Days to conversion", export: "Export CSV", last7: "Last 7 days", last30: "Last 30 days", last90: "Last 90 days", lastYear: "Last year", funnelSub: "From new lead to converted client." },
  es: { funnel: "Embudo", source: "Origen", score: "Puntuación", industry: "Industria", time: "En el tiempo",
    all: "Todo", d7: "7 días", d30: "30 días", d90: "90 días", y1: "1 año",
    new: "Nuevo", qualified: "Calificado", converted: "Convertido", hot: "Caliente", warm: "Tibio", cool: "Frío",
    total: "Total", conv: "Conversión", passthrough: "de paso", actionable: "Accionables", avgScore: "Puntuación media",
    google_maps: "Google Maps", website: "Sitios web", manual: "Manual", import: "Importado", leadsW: "leads", noData: "Sin datos en el periodo",
    funnelT: "Embudo de conversión", sourceT: "Conversión por origen", scoreT: "Distribución de puntuación", industryT: "Por industria", timeT: "Leads en el tiempo",
    totalPeriod: "Total en el periodo", daysToConv: "Días hasta conversión", export: "Exportar CSV", last7: "Últimos 7 días", last30: "Últimos 30 días", last90: "Últimos 90 días", lastYear: "Último año", funnelSub: "Del lead nuevo al cliente convertido." },
};

const palette = ["var(--ml-primary)", "var(--ml-blue)", "var(--ml-green)", "var(--ml-amber)", "var(--ml-red)", "var(--ml-navtext)"];

export function ReportsScreen() {
  const { lang } = useLang();
  const D = DICT[lang];
  const { leads, loading, error } = useLeads();
  const [tab, setTab] = useState<Tab>("funnel");
  const [period, setPeriod] = useState<Period>("all");

  const filtered = useMemo(() => {
    if (period === "all") return leads;
    const cutoff = Date.now() - Number(period) * 86400000;
    return leads.filter((l) => l.createdAt && new Date(l.createdAt).getTime() >= cutoff);
  }, [leads, period]);

  const data = useMemo(() => {
    const total = filtered.length;
    const status: Record<LeadStatus, number> = { new: 0, qualified: 0, converted: 0 };
    const temp = { hot: 0, warm: 0, cool: 0 };
    const bySource: Record<string, { n: number; conv: number }> = {};
    const byInd: Record<string, { n: number; conv: number }> = {};
    const month: Record<string, number> = {};
    let scoreSum = 0, convAgeSum = 0, convCount = 0;
    for (const l of filtered) {
      status[l.status]++;
      temp[l.temp]++;
      scoreSum += l.score;
      if (l.status === "converted" && l.createdAt) { convAgeSum += (Date.now() - new Date(l.createdAt).getTime()) / 86400000; convCount++; }
      const s = l.source || "manual";
      bySource[s] = bySource[s] || { n: 0, conv: 0 };
      bySource[s].n++; if (l.status === "converted") bySource[s].conv++;
      if (l.industry) { byInd[l.industry] = byInd[l.industry] || { n: 0, conv: 0 }; byInd[l.industry].n++; if (l.status === "converted") byInd[l.industry].conv++; }
      if (l.createdAt) { const m = l.createdAt.slice(0, 7); month[m] = (month[m] ?? 0) + 1; }
    }
    return {
      total, status, temp,
      avgScore: total ? Math.round(scoreSum / total) : 0,
      daysToConv: convCount ? Math.round((convAgeSum / convCount) * 10) / 10 : 0,
      qualRate: total ? Math.round((status.qualified / total) * 100) : 0,
      convRate: total ? Math.round((status.converted / total) * 1000) / 10 : 0,
      actionable: total ? Math.round(((temp.hot + temp.warm) / total) * 100) : 0,
      sourceRows: Object.entries(bySource).sort((a, b) => b[1].n - a[1].n),
      indRows: Object.entries(byInd).sort((a, b) => b[1].n - a[1].n).slice(0, 6),
      series: Object.entries(month).sort((a, b) => a[0].localeCompare(b[0])),
    };
  }, [filtered]);

  if (loading) return <Center><Icon name="loader" size={26} className="ml-spin" style={{ color: "var(--ml-primary)" }} /></Center>;
  if (error) return <Center><span style={{ color: "var(--ml-red)", fontSize: 14 }}>{error}</span></Center>;

  const tabs: [Tab, string, IconName][] = [["funnel", D.funnel, "chart"], ["source", D.source, "plug"], ["score", D.score, "award"], ["industry", D.industry, "database"], ["time", D.time, "timer"]];
  const periods: [Period, string][] = [["all", D.all], ["7", D.last7], ["30", D.last30], ["90", D.last90], ["365", D.lastYear]];
  const sourceLabel = (k: string) => (D as Record<string, string>)[k] || k;
  const numFmt = (n: number) => (lang === "en" ? String(n) : String(n).replace(".", ","));

  const kpis: { l: string; v: string; c: string; sub?: string }[] = (() => {
    if (tab === "funnel") return [{ l: D.totalPeriod, v: String(data.total), c: "var(--ml-text)" }, { l: D.qualified, v: String(data.status.qualified), c: STATUS_META.qualified.color, sub: data.qualRate + "%" }, { l: D.converted, v: String(data.status.converted), c: STATUS_META.converted.color, sub: numFmt(data.convRate) + "%" }, { l: D.daysToConv, v: numFmt(data.daysToConv), c: "var(--ml-primary)" }];
    if (tab === "score") return [{ l: D.hot, v: String(data.temp.hot), c: TEMP_META.hot.color }, { l: D.warm, v: String(data.temp.warm), c: TEMP_META.warm.color }, { l: D.cool, v: String(data.temp.cool), c: TEMP_META.cool.color }, { l: D.actionable, v: data.actionable + "%", c: "var(--ml-green)" }];
    return [{ l: D.totalPeriod, v: String(data.total), c: "var(--ml-text)" }, { l: D.converted, v: String(data.status.converted), c: STATUS_META.converted.color }, { l: D.conv, v: numFmt(data.convRate) + "%", c: "var(--ml-green)" }, { l: D.avgScore, v: String(data.avgScore), c: "var(--ml-primary)" }];
  })();

  function exportReport() {
    const rows = [["Empresa", "Status", "Industria", "Origem", "Score"], ...filtered.map((l) => [l.company, l.status, l.industry ?? "", l.source ?? "", String(l.score)])];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `relatorio_${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href);
  }

  return (
    <div className="ml-fade" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* tabs + period */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {tabs.map(([k, lbl, icon]) => {
            const on = tab === k;
            return <button key={k} onClick={() => setTab(k)} style={{ height: 40, padding: "0 16px", display: "flex", alignItems: "center", gap: 8, borderRadius: 11, fontSize: 13.5, fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? "#4c2ee0" : "var(--ml-border)"}`, background: on ? "#4c2ee0" : "var(--ml-card)", color: on ? "#fff" : "var(--ml-text)" }}><Icon name={icon} size={15} />{lbl}</button>;
          })}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} style={{ height: 40, padding: "0 14px", borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", fontSize: 13.5, fontWeight: 600, outline: "none", cursor: "pointer" }}>
            {periods.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button onClick={exportReport} style={{ height: 40, padding: "0 16px", display: "flex", alignItems: "center", gap: 8, borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", fontSize: 13.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}><Icon name="download" size={15} />{D.export}</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
        {kpis.map((k) => (
          <div key={k.l} style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 16, padding: "16px 18px", boxShadow: "0 1px 3px rgba(30,25,60,.04)" }}>
            <div style={{ fontSize: 12, color: "var(--ml-muted)" }}>{k.l}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: k.c, marginTop: 3 }}>{k.v}</div>
            {k.sub && <div style={{ fontSize: 11.5, color: "var(--ml-muted)", marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* viz */}
      <Card title={D[(tab + "T") as keyof typeof D] as string}>
        {tab === "funnel" && <Funnel data={data} D={D} />}
        {tab === "source" && <Bars palette={palette} emptyText={D.noData} detailRight
          rows={data.sourceRows.map(([k, v]) => ({ label: sourceLabel(k), value: v.n, detail: `${v.n} ${D.leadsW} · ${v.n ? Math.round((v.conv / v.n) * 100) : 0}% ${D.conv}` }))} />}
        {tab === "score" && <Bars palette={[TEMP_META.hot.color, TEMP_META.warm.color, TEMP_META.cool.color]} emptyText={D.noData}
          rows={[{ label: D.hot, value: data.temp.hot }, { label: D.warm, value: data.temp.warm }, { label: D.cool, value: data.temp.cool }]} />}
        {tab === "industry" && <Bars palette={palette} emptyText={D.noData} detailRight
          rows={data.indRows.map(([k, v]) => ({ label: k, value: v.n, detail: `${v.n} ${D.leadsW} · ${v.n ? Math.round((v.conv / v.n) * 100) : 0}% ${D.conv}` }))} />}
        {tab === "time" && <AreaChart series={data.series} labels={MONTHS[lang]} emptyText={D.noData} />}
      </Card>
    </div>
  );
}

function Funnel({ data, D }: { data: { total: number; status: Record<LeadStatus, number> }; D: Record<string, string> }) {
  if (data.total === 0) return <div style={{ display: "grid", placeItems: "center", minHeight: 160, color: "var(--ml-muted)", fontSize: 13 }}>{D.noData}</div>;
  const stages: [LeadStatus, string][] = [["new", D.new], ["qualified", D.qualified], ["converted", D.converted]];
  const base = data.status.new || 1;
  let prev = 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 760, margin: "0 auto" }}>
      <div style={{ fontSize: 13, color: "var(--ml-muted)", marginTop: -4 }}>{D.funnelSub}</div>
      {stages.map(([k, lbl], i) => {
        const count = data.status[k];
        const widthPct = Math.round((count / base) * 100);
        const rate = i === 0 ? 100 : prev ? Math.round((count / prev) * 100) : 0;
        prev = count;
        return (
          <div key={k}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 14, marginBottom: 7 }}>
              <span style={{ fontWeight: 700 }}>{lbl}</span>
              <span style={{ fontSize: 13, color: "var(--ml-muted)" }}>{count} · {rate}% {D.passthrough}</span>
            </div>
            <div style={{ height: 44, borderRadius: 12, background: "var(--ml-grid)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.max(widthPct, 6)}%`, background: STATUS_META[k].color, borderRadius: 12, display: "flex", alignItems: "center", paddingLeft: 16, color: "#fff", fontWeight: 800, fontSize: 16, transition: "width .3s" }}>{count}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Center({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", placeItems: "center", minHeight: 300 }}>{children}</div>;
}
