import { useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "../LangTheme";
import { Icon } from "../icons";

const DICT = {
  pt: {
    title: "Buscar e-mails", intro: "Vamos varrer o site de cada lead selecionado que ainda não tem e-mail e tentar encontrar o endereço de contato. É grátis e não gasta seu limite de extração.",
    eligible: "leads selecionados", searching: "Buscando e-mails…", start: "Buscar e-mails", cancel: "Cancelar", close: "Fechar",
    okTitle: "Busca concluída", found: "e-mails encontrados", processed: "sites analisados", none: "sem e-mail no site",
    noneEligible: "Nenhum dos leads selecionados tem site sem e-mail. Selecione leads que tenham website mas ainda sem e-mail.",
    failed: "Não foi possível concluir a busca agora.",
    hintFound: "Os e-mails já foram salvos nos leads e o score foi recalculado (+25 por e-mail).",
  },
  en: {
    title: "Find emails", intro: "We'll scan each selected lead's website that has no email yet and try to find the contact address. It's free and doesn't use your extraction quota.",
    eligible: "selected leads", searching: "Finding emails…", start: "Find emails", cancel: "Cancel", close: "Close",
    okTitle: "Search complete", found: "emails found", processed: "sites analyzed", none: "no email on site",
    noneEligible: "None of the selected leads have a website without an email. Select leads that have a website but no email yet.",
    failed: "Couldn't finish the search right now.",
    hintFound: "Emails were saved to the leads and the score was recalculated (+25 per email).",
  },
  es: {
    title: "Buscar emails", intro: "Escanearemos el sitio de cada lead seleccionado que aún no tiene email e intentaremos encontrar la dirección de contacto. Es gratis y no gasta tu límite de extracción.",
    eligible: "leads seleccionados", searching: "Buscando emails…", start: "Buscar emails", cancel: "Cancelar", close: "Cerrar",
    okTitle: "Búsqueda completa", found: "emails encontrados", processed: "sitios analizados", none: "sin email en el sitio",
    noneEligible: "Ninguno de los leads seleccionados tiene sitio sin email. Selecciona leads con sitio web pero aún sin email.",
    failed: "No se pudo completar la búsqueda ahora.",
    hintFound: "Los emails se guardaron en los leads y la puntuación se recalculó (+25 por email).",
  },
};

const BATCH = 10;

export function EnrichEmailsModal({ leadIds, onDone, onClose }: { leadIds: string[]; onDone: () => void; onClose: () => void }) {
  const { lang } = useLang();
  const D = DICT[lang];
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [live, setLive] = useState<{ found: number; done: number; total: number }>({ found: 0, done: 0, total: 0 });
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ found: number; processed: number; none: number } | null>(null);
  const root = document.querySelector(".ml-root") as HTMLElement | null;
  if (!root) return null;

  async function run() {
    setErr(null); setResult(null); setBusy(true); setProgress(0);
    const ids = [...leadIds];
    const batches = Math.max(1, Math.ceil(ids.length / BATCH));
    setLive({ found: 0, done: 0, total: ids.length });
    let found = 0, processed = 0, none = 0, failedBatches = 0;
    for (let b = 0; b < batches; b++) {
      const batch = ids.slice(b * BATCH, (b + 1) * BATCH);
      try {
        const { data, error } = await supabase.functions.invoke("enrich-emails", { body: { leadIds: batch } });
        if (error || data?.error) throw new Error(data?.error ?? "invoke_error");
        found += data.enriched ?? 0;
        processed += data.processed ?? 0;
        none += data.noEmail ?? 0;
        if ((data.enriched ?? 0) > 0) onDone(); // atualiza a lista em tempo real conforme acha
      } catch {
        failedBatches++; // um lote falhou (site pesado); pula e segue os demais
      }
      setProgress((b + 1) / batches);
      setLive({ found, done: Math.min(ids.length, (b + 1) * BATCH), total: ids.length });
    }
    setBusy(false);
    if (processed === 0 && failedBatches === batches) { setErr(D.failed); return; }
    setResult({ found, processed, none });
  }

  return createPortal(
    <div onClick={busy ? undefined : onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,17,40,.55)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", zIndex: 1000, padding: 24 }}>
      <div className="ml-float" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, background: "var(--ml-card)", borderRadius: 22, padding: 28, boxShadow: "0 30px 70px rgba(20,17,40,.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", color: "#fff", display: "grid", placeItems: "center" }}><Icon name="mail" size={18} /></div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{D.title}</div>
        </div>

        {!result && (
          <>
            <div style={{ fontSize: 13, color: "var(--ml-muted)", margin: "10px 0 16px", lineHeight: 1.55 }}>{D.intro}</div>
            <div style={{ fontSize: 13, color: "var(--ml-text)", marginBottom: 16 }}><b style={{ color: "var(--ml-primary)", fontSize: 16 }}>{leadIds.length}</b> {D.eligible}</div>

            {busy && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ height: 8, borderRadius: 20, background: "var(--ml-grid)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.round(progress * 100)}%`, borderRadius: 20, background: "linear-gradient(90deg,var(--ml-primary),var(--ml-primary-2))", transition: "width .3s" }} />
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ml-muted)", marginTop: 8, display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <Icon name="loader" size={13} className="ml-spin" />
                  <span>{live.done}/{live.total} {D.processed}</span>
                  <span style={{ color: "var(--ml-green)", fontWeight: 700 }}>· {live.found} {D.found}</span>
                </div>
              </div>
            )}

            {err && <div style={{ marginBottom: 14, fontSize: 13, color: "var(--ml-red)", background: "rgba(239,68,68,.1)", padding: "10px 12px", borderRadius: 10 }}>{err}</div>}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={run} disabled={busy || leadIds.length === 0} style={{ ...btnPrimary(busy), opacity: busy || leadIds.length === 0 ? 0.6 : 1 }}>{busy ? <Icon name="loader" size={15} className="ml-spin" /> : <Icon name="search" size={15} />}{busy ? D.searching : D.start}</button>
              <button onClick={onClose} disabled={busy} style={btnGhost}>{D.cancel}</button>
            </div>
          </>
        )}

        {result && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 14px" }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(16,185,129,.14)", display: "grid", placeItems: "center", color: "var(--ml-green)" }}><Icon name="check" size={17} /></div>
              <div style={{ fontWeight: 700 }}>{D.okTitle}</div>
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 13.5, marginBottom: 14 }}>
              <span><b style={{ color: "var(--ml-green)", fontSize: 18 }}>{result.found}</b> {D.found}</span>
              <span style={{ color: "var(--ml-muted)" }}><b>{result.processed}</b> {D.processed}</span>
              {result.none > 0 && <span style={{ color: "var(--ml-muted)" }}><b>{result.none}</b> {D.none}</span>}
            </div>
            {result.found > 0 && <div style={{ fontSize: 12.5, color: "var(--ml-muted)", marginBottom: 18, lineHeight: 1.5 }}>{D.hintFound}</div>}
            {result.found === 0 && result.processed === 0 && <div style={{ fontSize: 13, color: "var(--ml-muted)", marginBottom: 18, lineHeight: 1.5 }}>{D.noneEligible}</div>}
            <button onClick={onClose} style={btnPrimary(false)}>{D.close}</button>
          </div>
        )}
      </div>
    </div>,
    root
  );
}

const btnPrimary = (busy: boolean): CSSProperties => ({ display: "flex", alignItems: "center", gap: 7, padding: "11px 20px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", color: "#fff", fontWeight: 700, fontSize: 14, cursor: busy ? "default" : "pointer" });
const btnGhost: CSSProperties = { display: "flex", alignItems: "center", gap: 7, padding: "11px 18px", borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-navtext)", fontWeight: 600, fontSize: 14, cursor: "pointer" };
