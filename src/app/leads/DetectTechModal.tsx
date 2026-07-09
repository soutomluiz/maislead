import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "../LangTheme";
import { Icon } from "../icons";
import type { TechInfo } from "./model";
import { techWhat, type Lang } from "./techInsights";

const DICT = {
  pt: {
    title: "Detecção de Tecnologia", subBusy: "Analisando os sites…", subDone: "Análise concluída",
    searching: "Analisando", analyzed: "analisados",
    statDetected: "sites lidos", statNoPixel: "sem Pixel", statEcom: "e-commerce",
    detectedTitle: "Tecnologias detectadas", failedTitle: "Site não acessível", noPixelBadge: "sem Pixel",
    empty: "Nenhum dos leads selecionados tem site para analisar.",
    failed: "Não foi possível concluir a análise agora.", close: "Fechar",
    noStack: "Sem tecnologias reconhecidas",
  },
  en: {
    title: "Technology Detection", subBusy: "Analyzing websites…", subDone: "Analysis complete",
    searching: "Analyzing", analyzed: "analyzed",
    statDetected: "sites read", statNoPixel: "no Pixel", statEcom: "e-commerce",
    detectedTitle: "Detected technologies", failedTitle: "Site not reachable", noPixelBadge: "no Pixel",
    empty: "None of the selected leads has a website to analyze.",
    failed: "Couldn't finish the analysis right now.", close: "Close",
    noStack: "No recognized technologies",
  },
  es: {
    title: "Detección de Tecnología", subBusy: "Analizando los sitios…", subDone: "Análisis completo",
    searching: "Analizando", analyzed: "analizados",
    statDetected: "sitios leídos", statNoPixel: "sin Pixel", statEcom: "e-commerce",
    detectedTitle: "Tecnologías detectadas", failedTitle: "Sitio no accesible", noPixelBadge: "sin Pixel",
    empty: "Ninguno de los leads seleccionados tiene sitio para analizar.",
    failed: "No se pudo completar el análisis ahora.", close: "Cerrar",
    noStack: "Sin tecnologías reconocidas",
  },
};

const BATCH = 10;
type Res = { company: string; tech: TechInfo | null };

export function DetectTechModal({ leadIds, onDone, onClose }: { leadIds: string[]; onDone: () => void; onClose: () => void }) {
  const { lang } = useLang();
  const D = DICT[lang];
  const [busy, setBusy] = useState(true);
  const [progress, setProgress] = useState(0);
  const [live, setLive] = useState<{ done: number; total: number }>({ done: 0, total: leadIds.length });
  const [results, setResults] = useState<Res[]>([]);
  const [stats, setStats] = useState<{ detected: number; noPixel: number; ecom: number }>({ detected: 0, noPixel: 0, ecom: 0 });
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);
  const root = document.querySelector(".ml-root") as HTMLElement | null;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const ids = [...leadIds];
      const batches = Math.max(1, Math.ceil(ids.length / BATCH));
      let processed = 0, failedBatches = 0;
      const acc: Res[] = [];
      for (let b = 0; b < batches; b++) {
        const batch = ids.slice(b * BATCH, (b + 1) * BATCH);
        try {
          const { data, error } = await supabase.functions.invoke("detect-tech", { body: { leadIds: batch, redetect: true } });
          if (error || data?.error) throw new Error(data?.error ?? "invoke_error");
          processed += data.processed ?? 0;
          for (const r of (data.results ?? []) as Res[]) acc.push(r);
          if ((data.detected ?? 0) > 0) onDone();
        } catch { failedBatches++; }
        setProgress((b + 1) / batches);
        setLive({ done: Math.min(ids.length, (b + 1) * BATCH), total: ids.length });
      }
      setResults(acc);
      const okOnes = acc.filter((r) => r.tech && r.tech.ok);
      setStats({
        detected: okOnes.length,
        noPixel: okOnes.filter((r) => r.tech && !r.tech.has_pixel).length,
        ecom: okOnes.filter((r) => r.tech && r.tech.is_ecommerce).length,
      });
      setBusy(false);
      if (processed === 0 && failedBatches === batches) setErr(D.failed);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!root) return null;
  const okList = results.filter((r) => r.tech && r.tech.ok);
  const failList = results.filter((r) => !r.tech || !r.tech.ok);
  const noTargets = !busy && !err && results.length === 0;

  return createPortal(
    <div onClick={busy ? undefined : onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,17,40,.55)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", zIndex: 1000, padding: 24 }}>
      <div className="ml-float ml-scroll" onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", background: "var(--ml-card)", borderRadius: 22, boxShadow: "0 30px 70px rgba(20,17,40,.35)" }}>
        {/* Header */}
        <div style={{ position: "sticky", top: 0, background: "var(--ml-card)", display: "flex", alignItems: "center", gap: 12, padding: "22px 26px", borderBottom: "1px solid var(--ml-border)", zIndex: 1 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: "rgba(109,92,245,.13)", color: "#6d5cf5", display: "grid", placeItems: "center", flexShrink: 0 }}>
            {busy ? <Icon name="loader" size={22} className="ml-spin" /> : <Icon name="cpu" size={22} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{D.title}</div>
            <div style={{ fontSize: 12.5, color: "var(--ml-muted)" }}>{busy ? D.subBusy : D.subDone}</div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-muted)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--ml-red)"; e.currentTarget.style.borderColor = "var(--ml-red)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ml-muted)"; e.currentTarget.style.borderColor = "var(--ml-border)"; }}>
            <Icon name="x" size={16} strokeWidth={2.2} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 26px 26px" }}>
          {busy && (
            <div>
              <div style={{ height: 8, borderRadius: 20, background: "var(--ml-grid)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, borderRadius: 20, background: "linear-gradient(90deg,#6d5cf5,#8b6bff)", transition: "width .3s" }} />
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ml-muted)", marginTop: 10 }}>
                {D.searching} {live.done}/{live.total} {D.analyzed}
              </div>
            </div>
          )}

          {err && <div style={{ fontSize: 13.5, color: "var(--ml-red)", background: "rgba(239,68,68,.1)", padding: "12px 14px", borderRadius: 12 }}>{err}</div>}

          {noTargets && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, color: "#c07f0d", background: "rgba(245,158,11,.09)", border: "1px solid rgba(245,158,11,.25)", padding: "13px 15px", borderRadius: 13, lineHeight: 1.5 }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="info" size={16} /></span>{D.empty}
            </div>
          )}

          {!busy && !err && results.length > 0 && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 22 }}>
                <StatCard value={String(stats.detected)} label={D.statDetected} color="#6d5cf5" />
                <StatCard value={String(stats.noPixel)} label={D.statNoPixel} color="#c07f0d" />
                <StatCard value={String(stats.ecom)} label={D.statEcom} color="#059669" />
              </div>

              {okList.length > 0 && (
                <div style={{ marginBottom: failList.length ? 20 : 0 }}>
                  <div style={secTitle}>{D.detectedTitle} ({okList.length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {okList.map((r, i) => (
                      <div key={i} style={{ padding: "11px 14px", borderRadius: 12, border: "1px solid var(--ml-border)", background: "var(--ml-hover)" }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.company}</div>
                        <TechChips tech={r.tech!} noStack={D.noStack} noPixelLabel={D.noPixelBadge} lang={lang} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {failList.length > 0 && (
                <div>
                  <div style={secTitle}>{D.failedTitle} ({failList.length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {failList.map((r, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--ml-border)", background: "var(--ml-hover)" }}>
                        <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--ml-grid)", color: "var(--ml-muted)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="x" size={15} strokeWidth={2.2} /></span>
                        <span style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.company}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!busy && (
            <button onClick={onClose} style={{ width: "100%", height: 48, marginTop: 22, borderRadius: 13, border: "none", background: "linear-gradient(135deg,#6d5cf5,#8b6bff)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 6px 14px rgba(109,92,245,.25)" }}>{D.close}</button>
          )}
        </div>
      </div>
    </div>,
    root
  );
}

// Chips reutilizáveis das tecnologias de um lead. Exportado p/ uso no LeadDrawer.
// title (tooltip) explica "o que é" cada tecnologia — passe lang p/ ativar.
export function TechChips({ tech, noStack, noPixelLabel = "sem Pixel", lang }: { tech: TechInfo; noStack?: string; noPixelLabel?: string; lang?: Lang }) {
  const chips: { label: string; kind: "brand" | "pixel" | "warn" | "ecom"; title?: string }[] = [];
  const tip = (l: string) => (lang ? techWhat(l, lang) : undefined);
  if (tech.cms) chips.push({ label: tech.cms, kind: "brand", title: tip(tech.cms) });
  if (tech.builder) chips.push({ label: tech.builder, kind: "brand", title: tip(tech.builder) });
  for (const e of tech.ecommerce) chips.push({ label: e, kind: "ecom", title: tip(e) });
  for (const p of tech.pixels) chips.push({ label: p, kind: "pixel", title: tip(p) });
  for (const a of tech.analytics) chips.push({ label: a, kind: "brand", title: tip(a) });
  for (const m of tech.marketing) chips.push({ label: m, kind: "brand", title: tip(m) });
  for (const c of tech.chat) chips.push({ label: c, kind: "brand", title: tip(c) });
  // sinal de venda: tem site mas sem Pixel
  if (tech.ok && !tech.has_pixel) chips.push({ label: noPixelLabel, kind: "warn" });

  const style = (kind: string): CSSProperties => {
    if (kind === "pixel") return { background: "rgba(16,185,129,.12)", color: "#059669", border: "1px solid rgba(16,185,129,.25)" };
    if (kind === "ecom") return { background: "rgba(109,92,245,.1)", color: "#6d5cf5", border: "1px solid rgba(109,92,245,.22)" };
    if (kind === "warn") return { background: "rgba(245,158,11,.13)", color: "#c07f0d", border: "1px solid rgba(245,158,11,.3)", fontWeight: 700 };
    return { background: "var(--ml-grid)", color: "var(--ml-text)", border: "1px solid var(--ml-border)" };
  };

  if (!chips.length) return <span style={{ fontSize: 12, color: "var(--ml-muted)" }}>{noStack ?? "—"}</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {chips.map((c, i) => (
        <span key={i} title={c.title} style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 9px", borderRadius: 20, cursor: c.title ? "help" : "default", ...style(c.kind) }}>{c.label}</span>
      ))}
    </div>
  );
}

function StatCard({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div style={{ background: "var(--ml-hover)", border: "1px solid var(--ml-border)", borderRadius: 15, padding: "15px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? "var(--ml-text)" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "var(--ml-muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

const secTitle: CSSProperties = { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--ml-muted)", marginBottom: 10 };
