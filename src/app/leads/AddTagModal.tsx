import { useState, CSSProperties } from "react";
import { CenterModal } from "../CenterModal";
import { useLang } from "../LangTheme";
import { useAuth } from "../AuthContext";
import { Icon } from "../icons";
import { addTagToLeads } from "./useLeads";

const D = {
  pt: { title: "Adicionar Tag", to: "Aplicar em", leads: "leads", ph: "Ex.: Prioridade, Follow-up, Feira…", suggest: "Sugestões", cancel: "Cancelar", apply: "Aplicar tag", saving: "Aplicando…", err: "Não foi possível aplicar agora." },
  en: { title: "Add Tag", to: "Apply to", leads: "leads", ph: "e.g. Priority, Follow-up, Event…", suggest: "Suggestions", cancel: "Cancel", apply: "Apply tag", saving: "Applying…", err: "Couldn't apply right now." },
  es: { title: "Añadir Tag", to: "Aplicar a", leads: "leads", ph: "Ej.: Prioridad, Follow-up, Feria…", suggest: "Sugerencias", cancel: "Cancelar", apply: "Aplicar tag", saving: "Aplicando…", err: "No se pudo aplicar ahora." },
};
const SUGGESTIONS = ["Prioridade", "Follow-up", "Quente", "Reunião", "Proposta"];

export function AddTagModal({ leadIds, onClose, onDone }: { leadIds: string[]; onClose: () => void; onDone: () => void }) {
  const { lang } = useLang();
  const { account } = useAuth();
  const t = D[lang];
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function apply() {
    const val = tag.trim();
    if (!val || busy) return;
    setBusy(true); setErr(null);
    try {
      await addTagToLeads(leadIds, val, account?.id);
      onDone();
      onClose();
    } catch {
      setErr(t.err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <CenterModal onClose={onClose} width={440}>
      <div style={{ padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", color: "#fff", display: "grid", placeItems: "center" }}><Icon name="tag" size={17} /></div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{t.title}</div>
        </div>
        <div style={{ fontSize: 13, color: "var(--ml-muted)", marginBottom: 16 }}>{t.to}: <b style={{ color: "var(--ml-text)" }}>{leadIds.length}</b> {t.leads}</div>

        <input
          autoFocus
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
          placeholder={t.ph}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", fontSize: 14, outline: "none", boxSizing: "border-box" }}
        />

        <div style={{ fontSize: 12, color: "var(--ml-muted)", margin: "16px 0 8px", fontWeight: 600 }}>{t.suggest}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => setTag(s)} style={{ padding: "6px 13px", borderRadius: 20, border: `1px solid ${tag === s ? "var(--ml-primary)" : "var(--ml-border)"}`, background: tag === s ? "rgba(76,46,224,.12)" : "var(--ml-card)", color: tag === s ? "var(--ml-primary)" : "var(--ml-navtext)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{s}</button>
          ))}
        </div>

        {err && <div style={{ marginTop: 14, fontSize: 12.5, color: "var(--ml-red)" }}>{err}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={btnGhost}>{t.cancel}</button>
          <button onClick={apply} disabled={busy || !tag.trim()} style={{ ...btnPrimary, opacity: busy || !tag.trim() ? 0.6 : 1, cursor: busy || !tag.trim() ? "default" : "pointer" }}>
            {busy ? t.saving : t.apply}
          </button>
        </div>
      </div>
    </CenterModal>
  );
}

const btnGhost: CSSProperties = { padding: "11px 18px", borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-navtext)", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const btnPrimary: CSSProperties = { padding: "11px 18px", borderRadius: 11, border: "none", background: "var(--ml-primary)", color: "#fff", fontWeight: 700, fontSize: 14 };
