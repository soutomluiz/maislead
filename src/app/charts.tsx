import type { ReactNode } from "react";
import { Icon, IconName } from "./icons";

export function Card({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 16, padding: 18, boxShadow: "0 4px 16px rgba(30,25,70,.04)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Kpi({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon: IconName; color: string }) {
  return (
    <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 16, padding: 18, boxShadow: "0 4px 16px rgba(30,25,70,.04)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: "var(--ml-muted)", fontWeight: 600 }}>{label}</span>
        <span style={{ width: 34, height: 34, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--ml-grid)", color }}><Icon name={icon} size={17} /></span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: "var(--ml-muted)", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <div style={{ display: "grid", placeItems: "center", minHeight: 160, color: "var(--ml-muted)", fontSize: 13 }}>{text}</div>;
}

export function AreaChart({ series, labels, emptyText }: { series: [string, number][]; labels: string[]; emptyText: string }) {
  const W = 560, H = 200, pad = 28;
  if (series.length === 0) return <Empty text={emptyText} />;
  const max = Math.max(...series.map((s) => s[1]), 1);
  const n = series.length;
  const x = (i: number) => pad + (n === 1 ? (W - 2 * pad) / 2 : (i * (W - 2 * pad)) / (n - 1));
  const y = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const pts = series.map((s, i) => [x(i), y(s[1])] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0]},${H - pad} L${pts[0][0]},${H - pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <defs>
        <linearGradient id="mlArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6d5cf5" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#6d5cf5" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#mlArea)" />
      <path d={line} fill="none" stroke="#6d5cf5" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3.5} fill="#6d5cf5" />)}
      {series.map((s, i) => {
        const mi = parseInt(s[0].slice(5, 7), 10) - 1;
        return <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--ml-muted)">{labels[mi]}{`/${s[0].slice(2, 4)}`}</text>;
      })}
    </svg>
  );
}

export function Donut({ segments, total, unitLabel, emptyText }: { segments: { value: number; color: string; label: string }[]; total: number; unitLabel: string; emptyText: string }) {
  if (total === 0) return <Empty text={emptyText} />;
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg viewBox="0 0 140 140" width={140} height={140} style={{ flexShrink: 0 }}>
        <g transform="translate(70,70) rotate(-90)">
          <circle r={R} fill="none" stroke="var(--ml-grid)" strokeWidth={16} />
          {segments.map((s, i) => {
            const frac = total ? s.value / total : 0;
            const dash = frac * C;
            const el = <circle key={i} r={R} fill="none" stroke={s.color} strokeWidth={16} strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset} />;
            offset += dash;
            return el;
          })}
        </g>
        <text x={70} y={68} textAnchor="middle" fontSize={22} fontWeight={800} fill="var(--ml-text)">{total}</text>
        <text x={70} y={84} textAnchor="middle" fontSize={10} fill="var(--ml-muted)">{unitLabel}</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
            <span style={{ color: "var(--ml-text)", flex: 1 }}>{s.label}</span>
            <span style={{ fontWeight: 700 }}>{s.value}</span>
            <span style={{ color: "var(--ml-muted)", fontSize: 12, width: 40, textAlign: "right" }}>{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Bars({ rows, total, unit, palette, emptyText }: { rows: { label: string; value: number; detail?: string }[]; total: number; unit: string; palette: string[]; emptyText: string }) {
  if (rows.length === 0) return <Empty text={emptyText} />;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r, i) => (
        <div key={r.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
            <span style={{ color: "var(--ml-text)", fontWeight: 500 }}>{r.label}</span>
            <span style={{ color: "var(--ml-muted)" }}>{r.detail ?? `${r.value} ${unit}${total ? ` · ${Math.round((r.value / total) * 100)}%` : ""}`}</span>
          </div>
          <div style={{ height: 8, borderRadius: 6, background: "var(--ml-grid)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(r.value / max) * 100}%`, background: palette[i % palette.length], borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export const MONTHS: Record<string, string[]> = {
  pt: ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
};
