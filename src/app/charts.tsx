import type { ReactNode } from "react";
import { Icon, IconName } from "./icons";

const CARD_SHADOW = "0 1px 3px rgba(30,25,60,.04)";

export function Card({ title, right, titleGap = 18, children }: { title: string; right?: ReactNode; titleGap?: number; children: ReactNode }) {
  return (
    <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 20, padding: 24, boxShadow: CARD_SHADOW }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: titleGap }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

/** KPI card — DESIGN-SPEC §3.1: número 34px/800, ícone 42×42 raio 12, sombra sutil */
export function Kpi({ label, value, sub, icon, color, tint }: { label: string; value: string; sub?: ReactNode; icon: IconName; color: string; tint: string }) {
  return (
    <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 20, padding: "22px 24px", boxShadow: CARD_SHADOW }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 13, color: "var(--ml-muted)", fontWeight: 600 }}>{label}</div>
        <div style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 12, background: tint, color, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name={icon} size={20} />
        </div>
      </div>
      <div style={{ fontSize: 34, fontWeight: 800, marginTop: 12, letterSpacing: "-.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: "var(--ml-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function Empty({ text, minHeight = 170 }: { text: string; minHeight?: number }) {
  return <div style={{ display: "grid", placeItems: "center", minHeight, color: "var(--ml-muted)", fontSize: 13 }}>{text}</div>;
}

/**
 * Área com animação drawLine. Data-driven, mas mapeado no sistema de coordenadas
 * do protótipo (viewBox 0 0 860 280) com as 4 linhas de grade.
 */
export function AreaChart({ series, labels, emptyText }: { series: [string, number][]; labels: string[]; emptyText: string }) {
  if (series.length === 0) return <Empty text={emptyText} minHeight={250} />;
  const W = 860, H = 280, padX = 40, padTop = 20, padBottom = 40;
  const max = Math.max(...series.map((s) => s[1]), 1);
  const n = series.length;
  const x = (i: number) => padX + (n === 1 ? (W - 2 * padX) / 2 : (i * (W - 2 * padX)) / (n - 1));
  const y = (v: number) => padTop + (1 - v / max) * (H - padTop - padBottom);
  const pts = series.map((s, i) => [x(i), y(s[1])] as const);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(0)},${p[1].toFixed(0)}`).join(" ");
  const baseY = H - padBottom;
  const area = `${line} L${pts[pts.length - 1][0].toFixed(0)},${baseY} L${pts[0][0].toFixed(0)},${baseY} Z`;
  const last = pts[pts.length - 1];
  const gridYs = [20, 85, 150, 215];
  // rótulos: primeiro, ~meio, último
  const labelIdx = n <= 1 ? [0] : n === 2 ? [0, 1] : [0, Math.floor(n / 2), n - 1];
  const fmt = (key: string) => { const mi = parseInt(key.slice(5, 7), 10) - 1; return `${labels[mi] ?? ""}/${key.slice(2, 4)}`; };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 250, overflow: "visible" }}>
      <defs>
        <linearGradient id="mlArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6d5cf5" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#6d5cf5" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g stroke="var(--ml-grid)" strokeWidth={1}>
        {gridYs.map((gy) => <line key={gy} x1={0} y1={gy} x2={W} y2={gy} />)}
      </g>
      <path d={area} fill="url(#mlArea)" />
      <path d={line} fill="none" stroke="#6d5cf5" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={1400} style={{ animation: "drawLine 1.4s ease forwards" }} />
      <circle cx={last[0]} cy={last[1]} r={5} fill="#6d5cf5" stroke="var(--ml-card)" strokeWidth={2.5} />
      <g fill="var(--ml-muted)" fontSize={11} textAnchor="middle">
        {labelIdx.map((i) => <text key={i} x={x(i)} y={H - 18}>{fmt(series[i][0])}</text>)}
      </g>
    </svg>
  );
}

/** Donut — DESIGN-SPEC §3.2: raio 62, faixa 18px, girado -90°, 1º arco cresce (ringGrow), legenda embaixo */
export function Donut({ segments, total, unitLabel, emptyText }: { segments: { value: number; color: string; label: string }[]; total: number; unitLabel: string; emptyText: string }) {
  if (total === 0) return <Empty text={emptyText} />;
  const R = 62, C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = segments.map((s, i) => {
    const dash = (total ? s.value / total : 0) * C;
    const arc = (
      <circle key={i} cx={80} cy={80} r={R} fill="none" stroke={s.color} strokeWidth={18} strokeLinecap="round"
        strokeDasharray={`${dash} ${C}`} strokeDashoffset={-offset}
        style={i === 0 ? { animation: "ringGrow 1.1s ease forwards" } : undefined} />
    );
    offset += dash;
    return arc;
  });
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", minHeight: 170 }}>
        <svg viewBox="0 0 160 160" style={{ width: 170, height: 170, transform: "rotate(-90deg)" }}>
          <circle cx={80} cy={80} r={R} fill="none" stroke="var(--ml-grid)" strokeWidth={18} />
          {arcs}
        </svg>
        <div style={{ position: "absolute", textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{total}</div>
          <div style={{ fontSize: 11, color: "var(--ml-muted)" }}>{unitLabel}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: s.color }} />{s.label}
            </div>
            <span style={{ fontWeight: 700 }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Bars — DESIGN-SPEC §3.2: barra 9px, trilho grid, preenchimento com gradiente */
export function Bars({ rows, palette, emptyText, detailRight }: { rows: { label: string; value: number; detail?: string }[]; palette: string[]; emptyText: string; detailRight?: boolean }) {
  const filtered = rows.filter((r) => r.label && r.value > 0);
  if (filtered.length === 0) return <Empty text={emptyText} minHeight={120} />;
  const max = Math.max(...filtered.map((r) => r.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {filtered.map((r, i) => (
        <div key={r.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
            <span>{r.label}</span>
            {r.detail && detailRight
              ? <span style={{ color: "var(--ml-muted)" }}>{r.detail}</span>
              : <span style={{ fontWeight: 700 }}>{r.value}</span>}
          </div>
          <div style={{ height: 9, borderRadius: 6, background: "var(--ml-grid)", overflow: "hidden" }}>
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

/** Gradientes de preenchimento das barras (roxo / azul / verde) */
export const BAR_GRADIENTS = [
  "linear-gradient(90deg,#6d5cf5,#9d7bff)",
  "linear-gradient(90deg,#3b82f6,#60a5fa)",
  "linear-gradient(90deg,#10b981,#34d399)",
  "linear-gradient(90deg,#f59e0b,#fbbf24)",
  "linear-gradient(90deg,#ec4899,#f472b6)",
];
