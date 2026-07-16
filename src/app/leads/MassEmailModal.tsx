import { useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "../LangTheme";
import { Icon } from "../icons";

const DICT = {
  pt: {
    title: "E-mail em massa", to: "Para", recipients: "leads selecionados", template: "Modelo", subject: "Assunto", body: "Mensagem",
    vars: "Variáveis: {{empresa}}, {{cidade}}, {{setor}} são substituídas por lead.", send: "Enviar", sending: "Enviando…", cancel: "Cancelar",
    okTitle: "Envio concluído", sent: "enviados", skipped: "falharam", noEmail: "sem e-mail",
    reqContent: "Preencha assunto e mensagem.",
    errKey: "O envio de e-mails ainda não foi configurado no servidor. Assim que você enviar a chave do provedor (Resend), o disparo funciona de verdade.",
    errGated: "E-mail em massa está disponível nos planos Pro e Business.", errGeneric: "Não foi possível enviar agora.",
    templates: {
      intro: { name: "Apresentação", subject: "Olá {{empresa}}, uma oportunidade para vocês", body: "Olá, equipe da {{empresa}}!\n\nSou especialista em ajudar empresas do setor de {{setor}} em {{cidade}} a conquistar mais clientes. Podemos conversar 15 minutos esta semana?\n\nAbraço." },
      followup: { name: "Follow-up", subject: "Retomando o contato — {{empresa}}", body: "Oi, {{empresa}}!\n\nPassando para saber se você teve a chance de ver minha mensagem anterior. Fico à disposição para tirar qualquer dúvida.\n\nAté breve!" },
      proposal: { name: "Proposta", subject: "Proposta para {{empresa}}", body: "Olá, {{empresa}}!\n\nPreparei uma proposta pensada para o segmento de {{setor}}. Quando for um bom momento para eu apresentar os detalhes?\n\nObrigado!" },
    },
  },
  en: {
    title: "Mass email", to: "To", recipients: "selected leads", template: "Template", subject: "Subject", body: "Message",
    vars: "Variables: {{empresa}}, {{cidade}}, {{setor}} are replaced per lead.", send: "Send", sending: "Sending…", cancel: "Cancel",
    okTitle: "Send complete", sent: "sent", skipped: "failed", noEmail: "no email",
    reqContent: "Fill in subject and message.",
    errKey: "Email sending isn't configured on the server yet. As soon as you send the provider key (Resend), delivery works for real.",
    errGated: "Mass email is available on Pro and Business plans.", errGeneric: "Couldn't send right now.",
    templates: {
      intro: { name: "Introduction", subject: "Hi {{empresa}}, an opportunity for you", body: "Hi {{empresa}} team!\n\nI help {{setor}} businesses in {{cidade}} win more clients. Could we talk for 15 minutes this week?\n\nBest." },
      followup: { name: "Follow-up", subject: "Following up — {{empresa}}", body: "Hi {{empresa}}!\n\nJust checking if you had a chance to see my previous message. Happy to answer any questions.\n\nTalk soon!" },
      proposal: { name: "Proposal", subject: "Proposal for {{empresa}}", body: "Hi {{empresa}}!\n\nI put together a proposal for the {{setor}} segment. When would be a good time to walk you through it?\n\nThanks!" },
    },
  },
  es: {
    title: "Email masivo", to: "Para", recipients: "leads seleccionados", template: "Plantilla", subject: "Asunto", body: "Mensaje",
    vars: "Variables: {{empresa}}, {{cidade}}, {{setor}} se reemplazan por lead.", send: "Enviar", sending: "Enviando…", cancel: "Cancelar",
    okTitle: "Envío completo", sent: "enviados", skipped: "fallaron", noEmail: "sin email",
    reqContent: "Completa asunto y mensaje.",
    errKey: "El envío de emails aún no está configurado en el servidor. En cuanto envíes la clave del proveedor (Resend), el envío funciona de verdad.",
    errGated: "El email masivo está disponible en los planes Pro y Business.", errGeneric: "No se pudo enviar ahora.",
    templates: {
      intro: { name: "Presentación", subject: "Hola {{empresa}}, una oportunidad para ustedes", body: "¡Hola equipo de {{empresa}}!\n\nAyudo a empresas de {{setor}} en {{cidade}} a conseguir más clientes. ¿Podemos hablar 15 minutos esta semana?\n\nSaludos." },
      followup: { name: "Seguimiento", subject: "Retomando el contacto — {{empresa}}", body: "¡Hola {{empresa}}!\n\nSolo para saber si pudiste ver mi mensaje anterior. Quedo a disposición.\n\n¡Hasta pronto!" },
      proposal: { name: "Propuesta", subject: "Propuesta para {{empresa}}", body: "¡Hola {{empresa}}!\n\nPreparé una propuesta para el segmento de {{setor}}. ¿Cuándo sería buen momento para presentarla?\n\n¡Gracias!" },
    },
  },
};

type TplKey = "intro" | "followup" | "proposal";

export function MassEmailModal({ leadIds, onClose }: { leadIds: string[]; onClose: () => void }) {
  const { lang } = useLang();
  const D = DICT[lang];
  const [tpl, setTpl] = useState<TplKey>("intro");
  const [subject, setSubject] = useState(D.templates.intro.subject);
  const [body, setBody] = useState(D.templates.intro.body);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ sent: number; skipped: number; noEmail: number } | null>(null);
  const root = document.querySelector(".ml-root") as HTMLElement | null;
  if (!root) return null;

  function pickTemplate(k: TplKey) { setTpl(k); setSubject(D.templates[k].subject); setBody(D.templates[k].body); }

  async function send() {
    setErr(null); setResult(null);
    if (!subject.trim() || !body.trim()) { setErr(D.reqContent); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-emails", { body: { subject, body, leadIds } });
      let code: string | null = data?.error ?? null;
      if (error) { code = "errGeneric"; try { const b = await (error as { context?: { json?: () => Promise<{ error?: string }> } }).context?.json?.(); code = b?.error ?? code; } catch { /* ignore */ } }
      if (code) { setErr(code === "missing_api_key" ? D.errKey : code === "feature_gated" ? D.errGated : D.errGeneric); return; }
      setResult({ sent: data.sent ?? 0, skipped: data.skipped ?? 0, noEmail: data.noEmail ?? 0 });
    } catch { setErr(D.errGeneric); }
    finally { setBusy(false); }
  }

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,17,40,.55)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", zIndex: 1000, padding: 24 }}>
      <div className="ml-float ml-scroll" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 680, background: "var(--ml-card)", borderRadius: 22, padding: 28, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 30px 70px rgba(20,17,40,.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", color: "#fff", display: "grid", placeItems: "center" }}><Icon name="mail" size={18} /></div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{D.title}</div>
        </div>
        <div style={{ fontSize: 13, color: "var(--ml-muted)", marginBottom: 16 }}>{D.to}: <b style={{ color: "var(--ml-text)" }}>{leadIds.length}</b> {D.recipients}</div>

        {!result && (
          <>
            <label style={lbl}>{D.template}</label>
            <div style={{ display: "flex", gap: 7, marginBottom: 14, flexWrap: "wrap" }}>
              {(["intro", "followup", "proposal"] as TplKey[]).map((k) => (
                <button key={k} onClick={() => pickTemplate(k)} style={{ padding: "7px 14px", borderRadius: 20, border: `1px solid ${tpl === k ? "var(--ml-primary)" : "var(--ml-border)"}`, background: tpl === k ? "rgba(76,46,224,.12)" : "var(--ml-card)", color: tpl === k ? "var(--ml-primary)" : "var(--ml-navtext)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{D.templates[k].name}</button>
              ))}
            </div>

            <label style={lbl}>{D.subject}</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} style={{ ...inp, marginBottom: 12 }} />
            <label style={lbl}>{D.body}</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8} style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
            <div style={{ fontSize: 12, color: "var(--ml-muted)", marginTop: 6 }}>{D.vars}</div>

            {err && <div style={{ marginTop: 12, fontSize: 13, color: "var(--ml-red)", background: "rgba(239,68,68,.1)", padding: "10px 12px", borderRadius: 10, lineHeight: 1.5 }}>{err}</div>}

            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button onClick={send} disabled={busy} style={btnPrimary(busy)}>{busy ? <Icon name="loader" size={15} className="ml-spin" /> : <Icon name="mail" size={15} />}{busy ? D.sending : D.send}</button>
              <button onClick={onClose} disabled={busy} style={btnGhost}>{D.cancel}</button>
            </div>
          </>
        )}

        {result && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(16,185,129,.14)", display: "grid", placeItems: "center", color: "var(--ml-green)" }}><Icon name="check" size={17} /></div>
              <div style={{ fontWeight: 700 }}>{D.okTitle}</div>
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 13.5, marginBottom: 18 }}>
              <span><b style={{ color: "var(--ml-green)", fontSize: 18 }}>{result.sent}</b> {D.sent}</span>
              {result.skipped > 0 && <span style={{ color: "var(--ml-muted)" }}><b>{result.skipped}</b> {D.skipped}</span>}
              {result.noEmail > 0 && <span style={{ color: "var(--ml-muted)" }}><b>{result.noEmail}</b> {D.noEmail}</span>}
            </div>
            <button onClick={onClose} style={btnPrimary(false)}>OK</button>
          </div>
        )}
      </div>
    </div>,
    root
  );
}

const lbl: CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ml-navtext)", marginBottom: 6 };
const inp: CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", fontSize: 13.5, outline: "none" };
const btnPrimary = (busy: boolean): CSSProperties => ({ display: "flex", alignItems: "center", gap: 7, padding: "11px 20px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", color: "#fff", fontWeight: 700, fontSize: 14, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 });
const btnGhost: CSSProperties = { padding: "11px 18px", borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-navtext)", fontWeight: 600, fontSize: 14, cursor: "pointer" };
