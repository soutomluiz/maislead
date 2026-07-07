import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "../LangTheme";
import { Icon } from "../icons";

const DICT = {
  pt: {
    title: "Enriquecimento de E-mails", subBusy: "Buscando e-mails nos sites…", subDone: "Enriquecimento concluído",
    searching: "Analisando", analyzed: "analisados", statFound: "e-mails encontrados", statProcessed: "leads processados", statRate: "Taxa de acerto",
    foundTitle: "E-mails encontrados", noneTitle: "Sem e-mail público", notFound: "não encontrado",
    empty: "Todos os leads selecionados já têm e-mail. Selecione leads sem e-mail para enriquecer.",
    failed: "Não foi possível concluir a busca agora.", close: "Fechar",
  },
  en: {
    title: "Email Enrichment", subBusy: "Searching emails on websites…", subDone: "Enrichment complete",
    searching: "Analyzing", analyzed: "analyzed", statFound: "emails found", statProcessed: "leads processed", statRate: "Hit rate",
    foundTitle: "Emails found", noneTitle: "No public email", notFound: "not found",
    empty: "All selected leads already have an email. Select leads without email to enrich.",
    failed: "Couldn't finish the search right now.", close: "Close",
  },
  es: {
    title: "Enriquecimiento de Emails", subBusy: "Buscando emails en los sitios…", subDone: "Enriquecimiento completo",
    searching: "Analizando", analyzed: "analizados", statFound: "emails encontrados", statProcessed: "leads procesados", statRate: "Tasa de acierto",
    foundTitle: "Emails encontrados", noneTitle: "Sin email público", notFound: "no encontrado",
    empty: "Todos los leads seleccionados ya tienen email. Selecciona leads sin email para enriquecer.",
    failed: "No se pudo completar la búsqueda ahora.", close: "Cerrar",
  },
};

const BATCH = 10;
type Res = { company: string; email: string | null };

export function EnrichEmailsModal({ leadIds, onDone, onClose }: { leadIds: string[]; onDone: () => void; onClose: () => void }) {
  const { lang } = useLang();
  const D = DICT[lang];
  const [busy, setBusy] = useState(true);
  const [progress, setProgress] = useState(0);
  const [live, setLive] = useState<{ found: number; done: number; total: number }>({ found: 0, done: 0, total: leadIds.length });
  const [results, setResults] = useState<Res[]>([]);
  const [stats, setStats] = useState<{ found: number; processed: number; rate: number }>({ found: 0, processed: 0, rate: 0 });
  const [err, setErr] = useState<string | null>(null);
  const started = useRef(false);
  const root = document.querySelector(".ml-root") as HTMLElement | null;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const ids = [...leadIds];
      const batches = Math.max(1, Math.ceil(ids.length / BATCH));
      let found = 0, processed = 0, failedBatches = 0;
      const acc: Res[] = [];
      for (let b = 0; b < batches; b++) {
        const batch = ids.slice(b * BATCH, (b + 1) * BATCH);
        try {
          const { data, error } = await supabase.functions.invoke("enrich-emails", { body: { leadIds: batch } });
          if (error || data?.error) throw new Error(data?.error ?? "invoke_error");
          found += data.found ?? 0;
          processed += data.processed ?? 0;
          for (const r of (data.results ?? []) as Res[]) acc.push(r);
          if ((data.found ?? 0) > 0) onDone();
        } catch { failedBatches++; }
        setProgress((b + 1) / batches);
        setLive({ found, done: Math.min(ids.length, (b + 1) * BATCH), total: ids.length });
      }
      setResults(acc);
      setStats({ found, processed, rate: processed ? Math.round((found / processed) * 100) : 0 });
      setBusy(false);
      if (processed === 0 && failedBatches === batches) setErr(D.failed);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!root) return null;
  const foundList = results.filter((r) => r.email);
  const noneList = results.filter((r) => !r.email);
  const noTargets = !busy && !err && stats.processed === 0;

  return createPortal(
    <div onClick={busy ? undefined : onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,17,40,.55)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", zIndex: 1000, padding: 24 }}>
      <div className="ml-float ml-scroll" onClick={(e) => e.stopPropagation()} style={{ width: 560, maxWidth: "100%", maxHeight: "88vh", overflowY: "auto", background: "var(--ml-card)", borderRadius: 22, boxShadow: "0 30px 70px rgba(20,17,40,.35)" }}>
        {/* Header (sticky) */}
        <div style={{ position: "sticky", top: 0, background: "var(--ml-card)", display: "flex", alignItems: "center", gap: 12, padding: "22px 26px", borderBottom: "1px solid var(--ml-border)", zIndex: 1 }}>
          <div style={{ width: 46, height: 46, borderRadius: 13, background: "rgba(16,185,129,.13)", color: "#059669", display: "grid", placeItems: "center", flexShrink: 0 }}>
            {busy ? <Icon name="loader" size={22} className="ml-spin" /> : <Icon name="send" size={22} />}
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
              <div style={{ fontSize: 12.5, color: "var(--ml-muted)", marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span>{D.searching} {live.done}/{live.total} {D.analyzed}</span>
                <span style={{ color: "#059669", fontWeight: 700 }}>· {live.found} {D.statFound}</span>
              </div>
            </div>
          )}

          {err && <div style={{ fontSize: 13.5, color: "var(--ml-red)", background: "rgba(239,68,68,.1)", padding: "12px 14px", borderRadius: 12 }}>{err}</div>}

          {noTargets && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, color: "#c07f0d", background: "rgba(245,158,11,.09)", border: "1px solid rgba(245,158,11,.25)", padding: "13px 15px", borderRadius: 13, lineHeight: 1.5 }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="info" size={16} /></span>{D.empty}
            </div>
          )}

          {!busy && !err && stats.processed > 0 && (
            <>
              {/* 3 stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 22 }}>
                <StatCard value={String(stats.found)} label={D.statFound} color="#059669" />
                <StatCard value={String(stats.processed)} label={D.statProcessed} />
                <StatCard value={`${stats.rate}%`} label={D.statRate} color="#6d5cf5" />
              </div>

              {foundList.length > 0 && (
                <div style={{ marginBottom: noneList.length ? 20 : 0 }}>
                  <div style={secTitle}>{D.foundTitle} ({foundList.length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {foundList.map((r, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(16,185,129,.22)", background: "rgba(16,185,129,.05)" }}>
                        <span style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(16,185,129,.14)", color: "#059669", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="check" size={16} /></span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.company}</div>
                          <div style={{ fontSize: 12.5, color: "#059669", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.email}</div>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {noneList.length > 0 && (
                <div>
                  <div style={secTitle}>{D.noneTitle} ({noneList.length})</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {noneList.map((r, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--ml-border)", background: "var(--ml-hover)" }}>
                        <span style={{ width: 30, height: 30, borderRadius: 9, background: "var(--ml-grid)", color: "var(--ml-muted)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="x" size={15} strokeWidth={2.2} /></span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.company}</div>
                          <div style={{ fontSize: 12, color: "var(--ml-muted)" }}>{D.notFound}</div>
                        </span>
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

function StatCard({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div style={{ background: "var(--ml-hover)", border: "1px solid var(--ml-border)", borderRadius: 15, padding: "15px 16px", textAlign: "center" }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: color ?? "var(--ml-text)" }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "var(--ml-muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

const secTitle: CSSProperties = { fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--ml-muted)", marginBottom: 10 };
