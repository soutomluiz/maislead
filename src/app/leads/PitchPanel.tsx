import { useState, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "../icons";
import { usePlan, upsellText } from "../plan";

// IA de Abordagem — gera 3 mensagens de prospecção personalizadas a partir dos sinais do lead
// (tecnologia do site, reputação no Google, recém-aberta, CNAE…) via edge function generate-pitch
// (Claude Haiku 4.5). Reusável no popup do lead (leadId) e no staging de empresas (signals inline).

// sinais inline p/ empresas que ainda não estão no banco (StagingDetailModal)
export interface PitchInlineSignals {
  company?: string;
  razao_social?: string | null;
  cnae?: string | null;
  uf?: string | null;
  municipio?: string | null;
  porte?: string | null;
  abertura?: string | null;
  mei?: boolean;
  email?: string | null;
  phone?: string | null;
}

interface Opcao { tipo: "direta" | "dor" | "formal"; titulo: string; mensagem: string }
type Lang = "pt" | "en" | "es";

const DICT: Record<Lang, Record<string, string>> = {
  pt: { title: "IA de Abordagem", sub: "Gera 3 mensagens prontas usando os sinais deste lead.", gen: "Gerar Abordagem", again: "Gerar de novo", loading: "Escrevendo mensagens…", copy: "Copiar", copied: "Copiado!", fail: "Não foi possível gerar agora. Tente de novo.", noKey: "Falta configurar a chave da IA (ANTHROPIC_API_KEY) no Supabase." },
  en: { title: "Outreach AI", sub: "Generates 3 ready-to-send messages from this lead's signals.", gen: "Generate outreach", again: "Regenerate", loading: "Writing messages…", copy: "Copy", copied: "Copied!", fail: "Couldn't generate right now. Try again.", noKey: "The AI key (ANTHROPIC_API_KEY) isn't set in Supabase yet." },
  es: { title: "IA de Abordaje", sub: "Genera 3 mensajes listos usando las señales de este lead.", gen: "Generar abordaje", again: "Generar de nuevo", loading: "Escribiendo mensajes…", copy: "Copiar", copied: "¡Copiado!", fail: "No se pudo generar ahora. Inténtalo de nuevo.", noKey: "Falta configurar la clave de IA (ANTHROPIC_API_KEY) en Supabase." },
};

const TIPO_META: Record<Lang, Record<Opcao["tipo"], { label: string; color: string; bg: string }>> = {
  pt: { direta: { label: "Direta", color: "var(--ml-blue)", bg: "rgba(59,130,246,.12)" }, dor: { label: "Dor / Ajuda", color: "var(--ml-amber)", bg: "rgba(245,158,11,.14)" }, formal: { label: "Formal", color: "var(--ml-primary)", bg: "rgba(76,46,224,.12)" } },
  en: { direta: { label: "Direct", color: "var(--ml-blue)", bg: "rgba(59,130,246,.12)" }, dor: { label: "Pain / Help", color: "var(--ml-amber)", bg: "rgba(245,158,11,.14)" }, formal: { label: "Formal", color: "var(--ml-primary)", bg: "rgba(76,46,224,.12)" } },
  es: { direta: { label: "Directa", color: "var(--ml-blue)", bg: "rgba(59,130,246,.12)" }, dor: { label: "Dolor / Ayuda", color: "var(--ml-amber)", bg: "rgba(245,158,11,.14)" }, formal: { label: "Formal", color: "var(--ml-primary)", bg: "rgba(76,46,224,.12)" } },
};

export function PitchPanel({ leadId, signals, lang }: { leadId?: string; signals?: PitchInlineSignals; lang: Lang }) {
  const D = DICT[lang];
  const TM = TIPO_META[lang];
  const { can } = usePlan();
  const locked = !can("pitch");
  const [loading, setLoading] = useState(false);
  const [opcoes, setOpcoes] = useState<Opcao[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  async function generate() {
    setLoading(true); setErr(null);
    try {
      const body: Record<string, unknown> = { lang };
      if (leadId) body.leadId = leadId;
      else if (signals) body.signals = signals;
      const { data, error } = await supabase.functions.invoke("generate-pitch", { body });
      if (error || data?.error) {
        setErr(data?.error === "no_api_key" ? D.noKey : D.fail);
        return;
      }
      const list = (data?.opcoes ?? []) as Opcao[];
      if (!list.length) { setErr(D.fail); return; }
      // ordena: direta, dor, formal
      const order: Opcao["tipo"][] = ["direta", "dor", "formal"];
      list.sort((a, b) => order.indexOf(a.tipo) - order.indexOf(b.tipo));
      setOpcoes(list);
    } catch { setErr(D.fail); }
    finally { setLoading(false); }
  }

  async function copy(text: string, i: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied((c) => (c === i ? null : c)), 1600);
    } catch { /* clipboard bloqueado — ignora */ }
  }

  return (
    <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 16, padding: 16, marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: opcoes ? 12 : 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--ml-primary)" }}><Icon name="spark" size={15} /></span>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ml-navtext)" }}>{D.title}</div>
        </div>
        {locked ? (
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--ml-primary)", background: "rgba(76,46,224,.1)", padding: "7px 12px", borderRadius: 9 }}>
            <Icon name="crown" size={13} /> Business
          </span>
        ) : (
          <button onClick={generate} disabled={loading} style={miniBtn(loading)}>
            {loading ? <Icon name="loader" size={13} className="ml-spin" /> : <Icon name={opcoes ? "refresh" : "chat"} size={13} />}
            {loading ? D.loading : opcoes ? D.again : D.gen}
          </button>
        )}
      </div>

      {locked && (
        <div style={{ fontSize: 12.5, color: "var(--ml-muted)", marginTop: 10, lineHeight: 1.5 }}>{upsellText("pitch", lang)}</div>
      )}
      {!locked && !opcoes && !loading && !err && (
        <div style={{ fontSize: 12.5, color: "var(--ml-muted)", marginTop: 10, lineHeight: 1.5 }}>{D.sub}</div>
      )}

      {err && <div style={{ fontSize: 12.5, color: "var(--ml-red)", marginTop: 10, lineHeight: 1.5 }}>{err}</div>}

      {opcoes && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {opcoes.map((o, i) => {
            const m = TM[o.tipo] ?? TM.direta;
            const isCopied = copied === i;
            return (
              <div key={i} style={{ background: "var(--ml-grid)", border: "1px solid var(--ml-border)", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color: m.color, background: m.bg, padding: "3px 9px", borderRadius: 20, whiteSpace: "nowrap" }}>{m.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ml-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.titulo}</span>
                  </div>
                  <button onClick={() => copy(o.mensagem, i)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: isCopied ? "var(--ml-green)" : "var(--ml-primary)", fontWeight: 600, fontSize: 11.5, cursor: "pointer", flexShrink: 0 }}>
                    <Icon name={isCopied ? "check" : "copy"} size={12} />{isCopied ? D.copied : D.copy}
                  </button>
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ml-text)", whiteSpace: "pre-wrap" }}>{o.mensagem}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function miniBtn(loading: boolean): CSSProperties {
  return { display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9, border: "1px solid var(--ml-primary)", background: "rgba(76,46,224,.08)", color: "var(--ml-primary)", fontWeight: 600, fontSize: 12.5, cursor: loading ? "default" : "pointer", whiteSpace: "nowrap" };
}
