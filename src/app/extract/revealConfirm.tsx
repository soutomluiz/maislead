import { useRef, useState, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../AuthContext";
import { useLang } from "../LangTheme";
import { Icon } from "../icons";
import { CenterModal } from "../CenterModal";

// Confirmação de "revelar" compartilhada pelas telas da Empresas (Por CNPJ, Recém-abertas,
// Espelhar) — mesmo padrão do Google Places. A preferência "não mostrar de novo" fica no
// perfil (profiles.hide_reveal_confirm), então vale em qualquer dispositivo — igual ao Places.

const DICT = {
  pt: {
    reveal: "Revelar selecionados", revealCost: (n: number) => `usa ${n} ${n === 1 ? "lead" : "leads"} da cota`,
    revealTitle: "Revelar contatos",
    confirmReveal: (n: number) => `Revelar ${n} ${n === 1 ? "lead vai usar 1 lead" : `leads vai usar ${n} leads`} do seu limite mensal. Continuar?`,
    confirm: "Confirmar", cancel: "Cancelar", dontAskAgain: "Não mostrar esta mensagem novamente",
  },
  en: {
    reveal: "Reveal selected", revealCost: (n: number) => `uses ${n} ${n === 1 ? "lead" : "leads"} from quota`,
    revealTitle: "Reveal contacts",
    confirmReveal: (n: number) => `Revealing ${n} ${n === 1 ? "lead will use 1 lead" : `leads will use ${n} leads`} of your monthly limit. Continue?`,
    confirm: "Confirm", cancel: "Cancel", dontAskAgain: "Don't show this message again",
  },
  es: {
    reveal: "Revelar seleccionados", revealCost: (n: number) => `usa ${n} ${n === 1 ? "lead" : "leads"} de la cuota`,
    revealTitle: "Revelar contactos",
    confirmReveal: (n: number) => `Revelar ${n} ${n === 1 ? "lead usará 1 lead" : `leads usará ${n} leads`} de tu límite mensual. ¿Continuar?`,
    confirm: "Confirmar", cancel: "Cancelar", dontAskAgain: "No mostrar este mensaje de nuevo",
  },
};

export function revealStrings(lang: "pt" | "en" | "es") { return DICT[lang]; }

// Hook: request(count, action) abre o modal (ou revela direto se o usuário já dispensou o aviso).
// `modal` é o JSX que a tela deve renderizar.
export function useRevealConfirm() {
  const { lang } = useLang();
  const { profile, refresh } = useAuth();
  const D = DICT[lang];
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [dontAsk, setDontAsk] = useState(false);
  const [saving, setSaving] = useState(false);
  const pending = useRef<null | (() => void | Promise<void>)>(null);

  function request(n: number, action: () => void | Promise<void>) {
    if (n <= 0) return;
    if (profile?.hide_reveal_confirm) { action(); return; }
    pending.current = action;
    setCount(n); setDontAsk(false); setOpen(true);
  }

  async function onConfirm() {
    if (dontAsk && profile?.id) {
      setSaving(true);
      try { await supabase.from("profiles").update({ hide_reveal_confirm: true }).eq("id", profile.id); await refresh(); }
      catch { /* preferência é best-effort; não bloqueia o reveal */ }
      finally { setSaving(false); }
    }
    setOpen(false);
    const action = pending.current; pending.current = null;
    if (action) await action();
  }

  const modal = open ? (
    <CenterModal onClose={() => setOpen(false)} width={440}>
      <div style={{ padding: "26px 26px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(76,46,224,.12)", color: "var(--ml-primary)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icon name="check" size={22} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{D.revealTitle}</div>
        </div>

        <div style={{ fontSize: 14, color: "var(--ml-text)", lineHeight: 1.55 }}>{D.confirmReveal(count)}</div>

        <label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 18, fontSize: 13, color: "var(--ml-muted)", cursor: "pointer", userSelect: "none" }}>
          <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: "#4c2ee0", cursor: "pointer", flexShrink: 0 }} />
          {D.dontAskAgain}
        </label>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
          <button onClick={() => setOpen(false)} disabled={saving}
            style={{ padding: "11px 20px", borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-navtext)", fontWeight: 600, fontSize: 14, cursor: saving ? "default" : "pointer" }}>
            {D.cancel}
          </button>
          <button onClick={onConfirm} disabled={saving}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 22px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,#4c2ee0,#6d4bff)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1 }}>
            {saving ? <Icon name="loader" size={15} className="ml-spin" /> : <Icon name="check" size={15} />}
            {D.confirm}
          </button>
        </div>
      </div>
    </CenterModal>
  ) : null;

  return { request, modal };
}

// Célula de contato mascarado para as linhas de resultado (telefone/e-mail).
// owned → texto completo; senão → máscara ou "•••".
export function maskedContact(masked: string | null, hasIt: boolean, full: string | null | undefined, owned: boolean): { text: string | null; owned: boolean } {
  if (owned) return { text: full || "—", owned: true };
  return { text: masked || (hasIt ? "•••" : null), owned: false };
}

export const revealBtnStyle = (enabled: boolean): CSSProperties => ({
  display: "flex", alignItems: "center", gap: 8, height: 44, padding: "0 20px", borderRadius: 12, border: "none",
  background: enabled ? "linear-gradient(135deg,#4c2ee0,#6d4bff)" : "var(--ml-border)",
  color: enabled ? "#fff" : "var(--ml-muted)", fontWeight: 700, fontSize: 14,
  cursor: enabled ? "pointer" : "default", opacity: enabled ? 1 : 0.7,
  marginLeft: "auto", boxShadow: enabled ? "0 8px 18px rgba(76,46,224,.28)" : "none",
});
