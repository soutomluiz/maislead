import { useLang } from "../LangTheme";
import type { FunnelCounts } from "./data";

const pctOf = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export function FunnelCard({ counts }: { counts: FunnelCounts }) {
  const { t } = useLang();
  const F = t.funnel;
  const { total, contacted, scheduled, followup, lost, won } = counts;

  const barH = (n: number) => (total > 0 ? Math.max(14, Math.round((n / total) * 100)) : 14);

  const bars = [
    { grad: "linear-gradient(180deg,#b8bfcc,#94a3b8)", value: total, label: F.totalLabel, sub: "100%", subColor: "var(--ml-muted)", h: 100, fs: 30 },
    { grad: "linear-gradient(180deg,#60a5fa,#3b82f6)", value: contacted, label: F.contactedLabel, sub: `${pctOf(contacted, total)}% ${F.ofTotal}`, subColor: "#3b82f6", h: barH(contacted), fs: 28 },
    { grad: "linear-gradient(180deg,#34d399,#10b981)", value: scheduled, label: F.scheduledLabel, sub: `${pctOf(scheduled, contacted)}% ${F.ofContacted}`, subColor: "#10b981", h: barH(scheduled), fs: 26 },
    { grad: "linear-gradient(180deg,#fbbf24,#f59e0b)", value: followup, label: F.followLabel, sub: `${pctOf(followup, contacted)}% ${F.ofContacted}`, subColor: "#f59e0b", h: barH(followup), fs: 24 },
    { grad: "linear-gradient(180deg,#f87171,#ef4444)", value: lost, label: F.lostLabel, sub: `${pctOf(lost, contacted)}% ${F.ofContacted}`, subColor: "#ef4444", h: barH(lost), fs: 24 },
    { grad: "linear-gradient(180deg,#6d4bff,#4c2ee0)", value: won, label: F.wonLabel, sub: `${pctOf(won, scheduled)}% ${F.ofScheduled}`, subColor: "#4c2ee0", h: barH(won), fs: 24 },
  ];

  const rates = [
    { pct: pctOf(won, total), tint: "rgba(76,46,224,.12)", color: "#4c2ee0", label: F.rateConv, sub: F.rateConvSub },
    { pct: pctOf(contacted, total), tint: "rgba(59,130,246,.13)", color: "#3b82f6", label: F.rateContact, sub: F.rateContactSub },
    { pct: pctOf(scheduled, contacted), tint: "rgba(16,185,129,.14)", color: "#10b981", label: F.rateSched, sub: F.rateSchedSub },
  ];

  return (
    <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 20, padding: 24, boxShadow: "0 1px 3px rgba(30,25,60,.04)" }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{F.title}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 200 }}>
        {bars.map((b, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
            <div style={{ width: "100%", height: `${b.h}%`, borderRadius: "12px 12px 0 0", background: b.grad, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: b.fs, fontWeight: 800 }}>{b.value}</div>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 10 }}>{b.label}</div>
            <div style={{ fontSize: 11.5, color: b.subColor, fontWeight: 600 }}>{b.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginTop: 22, paddingTop: 20, borderTop: "1px solid var(--ml-border)" }}>
        {rates.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: r.tint, color: r.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800 }}>{r.pct}%</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{r.label}</div>
              <div style={{ fontSize: 11.5, color: "var(--ml-muted)" }}>{r.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
