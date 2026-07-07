import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "./LangTheme";
import { useAuth } from "./AuthContext";
import { Icon } from "./icons";

type Group = "crmPop" | "crmBr" | "auto";
interface Provider { id: string; name: string; sub: string; color: string; initials: string; group: Group; }

const PROVIDERS: Provider[] = [
  { id: "hubspot", name: "HubSpot", sub: "CRM & Marketing", color: "#ff7a59", initials: "H", group: "crmPop" },
  { id: "salesforce", name: "Salesforce", sub: "Enterprise CRM", color: "#00a1e0", initials: "SF", group: "crmPop" },
  { id: "pipedrive", name: "Pipedrive", sub: "Sales pipeline", color: "#111827", initials: "P", group: "crmPop" },
  { id: "zoho", name: "Zoho CRM", sub: "Suite completa", color: "#e42527", initials: "Z", group: "crmPop" },
  { id: "activecampaign", name: "ActiveCampaign", sub: "Email & CRM", color: "#356ae6", initials: "AC", group: "crmPop" },
  { id: "freshsales", name: "Freshsales", sub: "CRM Freshworks", color: "#ff7a00", initials: "FS", group: "crmPop" },
  { id: "rdstation", name: "RD Station", sub: "Marketing & CRM", color: "#1f9c9c", initials: "RD", group: "crmBr" },
  { id: "ploomes", name: "Ploomes", sub: "CRM nacional", color: "#2f6fed", initials: "PL", group: "crmBr" },
  { id: "agendor", name: "Agendor", sub: "CRM de vendas", color: "#00b96b", initials: "AG", group: "crmBr" },
  { id: "piperun", name: "PipeRun", sub: "CRM & vendas", color: "#ff5a1f", initials: "PR", group: "crmBr" },
  { id: "zapier", name: "Zapier", sub: "5000+ apps", color: "#ff4a00", initials: "Zp", group: "auto" },
  { id: "make", name: "Make", sub: "Automação visual", color: "#6d00cc", initials: "Mk", group: "auto" },
  { id: "n8n", name: "n8n", sub: "Open-source", color: "#ea4b71", initials: "n8", group: "auto" },
  { id: "webhook", name: "Webhook", sub: "Endpoint custom", color: "#6d5cf5", initials: "{}", group: "auto" },
];

const DICT = {
  pt: {
    header: "Integrações", headerSub: "Conecte o maisLEAD ao seu CRM e envie leads automaticamente.", connectedCount: "conectados",
    grpPop: "CRMs Populares", grpBr: "CRMs Brasileiros", grpAuto: "Automação & Webhooks",
    connected: "Conectado", connect: "Conectar", manage: "Gerenciar",
    modalTitle: "Conectar", urlLabel: "URL do Webhook", urlHint: "Cada novo lead será enviado via POST (JSON) para esta URL.",
    test: "Testar", tested: "Enviado! Verifique o destino.", testFail: "Falha ao enviar o teste.",
    save: "Salvar conexão", saved: "Integração conectada!", disconnect: "Desconectar", cancel: "Cancelar",
    reqUrl: "Informe uma URL válida (https://…).", saveErr: "Erro ao salvar a integração.",
    how: "Como obter a URL", howCrm: "No seu CRM, crie um gatilho/inbound webhook (ou um Zap no Zapier) e cole aqui a URL gerada.",
  },
  en: {
    header: "Integrations", headerSub: "Connect maisLEAD to your CRM and send leads automatically.", connectedCount: "connected",
    grpPop: "Popular CRMs", grpBr: "Brazilian CRMs", grpAuto: "Automation & Webhooks",
    connected: "Connected", connect: "Connect", manage: "Manage",
    modalTitle: "Connect", urlLabel: "Webhook URL", urlHint: "Each new lead will be POSTed (JSON) to this URL.",
    test: "Test", tested: "Sent! Check the destination.", testFail: "Failed to send test.",
    save: "Save connection", saved: "Integration connected!", disconnect: "Disconnect", cancel: "Cancel",
    reqUrl: "Enter a valid URL (https://…).", saveErr: "Error saving the integration.",
    how: "How to get the URL", howCrm: "In your CRM, create a trigger/inbound webhook (or a Zap on Zapier) and paste the generated URL here.",
  },
  es: {
    header: "Integraciones", headerSub: "Conecta maisLEAD a tu CRM y envía leads automáticamente.", connectedCount: "conectados",
    grpPop: "CRMs Populares", grpBr: "CRMs Brasileños", grpAuto: "Automatización & Webhooks",
    connected: "Conectado", connect: "Conectar", manage: "Gestionar",
    modalTitle: "Conectar", urlLabel: "URL del Webhook", urlHint: "Cada nuevo lead se enviará vía POST (JSON) a esta URL.",
    test: "Probar", tested: "¡Enviado! Revisa el destino.", testFail: "Fallo al enviar la prueba.",
    save: "Guardar conexión", saved: "¡Integración conectada!", disconnect: "Desconectar", cancel: "Cancelar",
    reqUrl: "Ingresa una URL válida (https://…).", saveErr: "Error al guardar la integración.",
    how: "Cómo obtener la URL", howCrm: "En tu CRM, crea un disparador/webhook de entrada (o un Zap en Zapier) y pega aquí la URL generada.",
  },
};

interface Row { id: string; provider: string; webhook_url: string | null; status: string; }
const SAMPLE = { event: "lead.created", source: "maisLEAD", lead: { company: "Empresa Exemplo", email: "contato@exemplo.com", phone: "+55 11 90000-0000", score: 85 } };

export function IntegrationsScreen() {
  const { lang } = useLang();
  const { account } = useAuth();
  const D = DICT[lang];
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<Provider | null>(null);

  async function load() {
    if (!account?.id) return;
    const { data } = await supabase.from("integrations").select("id, provider, webhook_url, status").eq("account_id", account.id);
    setRows((data as Row[]) ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [account?.id]);

  const byProvider = useMemo(() => Object.fromEntries(rows.map((r) => [r.provider, r])), [rows]);
  const connectedCount = rows.filter((r) => r.status === "connected").length;

  const groups: { key: Group; title: string }[] = [
    { key: "crmPop", title: D.grpPop },
    { key: "crmBr", title: D.grpBr },
    { key: "auto", title: D.grpAuto },
  ];

  return (
    <div className="ml-fade" style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* banner */}
      <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(120deg,#6d5cf5,#9d7bff)", borderRadius: 20, padding: "26px 28px", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", boxShadow: "0 12px 30px rgba(109,92,245,.25)" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{D.header}</div>
          <div style={{ fontSize: 13.5, opacity: 0.92, marginTop: 4, maxWidth: 520 }}>{D.headerSub}</div>
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, background: "rgba(255,255,255,.2)", padding: "9px 16px", borderRadius: 12, whiteSpace: "nowrap" }}>
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 0 4px rgba(74,222,128,.3)" }} />{connectedCount} {D.connectedCount}
        </span>
      </div>

      {groups.map((g) => (
        <div key={g.key}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: "var(--ml-muted)", marginBottom: 12 }}>{g.title}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16 }}>
            {PROVIDERS.filter((p) => p.group === g.key).map((p) => {
              const row = byProvider[p.id];
              const on = row?.status === "connected";
              return (
                <div key={p.id} style={{ background: "var(--ml-card)", border: `1px solid ${on ? "var(--ml-green)" : "var(--ml-border)"}`, borderRadius: 18, padding: 20, boxShadow: "0 1px 3px rgba(30,25,60,.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 13, background: p.color, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>{p.initials}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                      <div style={{ fontSize: 12.5, color: "var(--ml-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.sub}</div>
                    </div>
                    {on && <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--ml-green)", background: "rgba(16,185,129,.12)", padding: "3px 8px", borderRadius: 20 }}><Icon name="check" size={11} />{D.connected}</span>}
                  </div>
                  <button onClick={() => setOpen(p)} style={{ width: "100%", height: 40, marginTop: 0, borderRadius: 11, border: on ? "1px solid var(--ml-border)" : "none", background: on ? "var(--ml-card)" : "linear-gradient(135deg,#6d5cf5,#8b6bff)", color: on ? "var(--ml-green)" : "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                    {on ? D.manage : D.connect}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {open && <ConnectModal provider={open} row={byProvider[open.id]} onClose={() => setOpen(null)} onSaved={() => { load(); setOpen(null); }} D={D} accountId={account?.id} />}
    </div>
  );
}

function ConnectModal({ provider, row, onClose, onSaved, D, accountId }: { provider: Provider; row?: Row; onClose: () => void; onSaved: () => void; D: (typeof DICT)["pt"]; accountId?: string }) {
  const [url, setUrl] = useState(row?.webhook_url ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const root = document.querySelector(".ml-root") as HTMLElement | null;
  if (!root) return null;

  const valid = /^https?:\/\/.+/i.test(url.trim());

  async function test() {
    setMsg(null);
    if (!valid) { setMsg({ ok: false, text: D.reqUrl }); return; }
    setBusy(true);
    try {
      await fetch(url.trim(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...SAMPLE, provider: provider.id }), mode: "no-cors" });
      setMsg({ ok: true, text: D.tested });
    } catch { setMsg({ ok: false, text: D.testFail }); }
    finally { setBusy(false); }
  }

  async function save() {
    setMsg(null);
    if (!valid) { setMsg({ ok: false, text: D.reqUrl }); return; }
    if (!accountId) return;
    setBusy(true);
    try {
      if (row?.id) {
        const { error } = await supabase.from("integrations").update({ webhook_url: url.trim(), status: "connected" }).eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("integrations").insert({ account_id: accountId, provider: provider.id, webhook_url: url.trim(), status: "connected" });
        if (error) throw error;
      }
      onSaved();
    } catch { setMsg({ ok: false, text: D.saveErr }); }
    finally { setBusy(false); }
  }

  async function disconnect() {
    if (!row?.id) return;
    setBusy(true);
    try { await supabase.from("integrations").delete().eq("id", row.id); onSaved(); }
    finally { setBusy(false); }
  }

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,17,40,.55)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", zIndex: 1000, padding: 24 }}>
      <div className="ml-float" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: "var(--ml-card)", borderRadius: 22, padding: 28, boxShadow: "0 30px 70px rgba(20,17,40,.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 50, height: 50, borderRadius: 14, background: provider.color, color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 18 }}>{provider.initials}</div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{D.modalTitle} {provider.name}</div>
        </div>

        <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ml-navtext)" }}>{D.urlLabel}</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" style={{ width: "100%", marginTop: 6, padding: "11px 13px", borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", fontSize: 14, outline: "none" }} />
        <div style={{ fontSize: 12, color: "var(--ml-muted)", marginTop: 6 }}>{D.urlHint}</div>
        {provider.group !== "auto" && <div style={{ fontSize: 12, color: "var(--ml-muted)", marginTop: 8, background: "var(--ml-grid)", padding: "9px 11px", borderRadius: 9, lineHeight: 1.5 }}><b>{D.how}:</b> {D.howCrm}</div>}

        {msg && <div style={{ marginTop: 12, fontSize: 13, color: msg.ok ? "var(--ml-green)" : "var(--ml-red)", background: msg.ok ? "rgba(16,185,129,.12)" : "rgba(239,68,68,.1)", padding: "9px 11px", borderRadius: 9 }}>{msg.text}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
          <button onClick={save} disabled={busy} style={btnPrimary(busy)}>{busy && <Icon name="loader" size={15} className="ml-spin" />}{D.save}</button>
          <button onClick={test} disabled={busy} style={btnGhost}>{D.test}</button>
          <div style={{ flex: 1 }} />
          {row?.id && <button onClick={disconnect} disabled={busy} style={{ ...btnGhost, color: "var(--ml-red)", borderColor: "var(--ml-border)" }}>{D.disconnect}</button>}
          <button onClick={onClose} disabled={busy} style={btnGhost}>{D.cancel}</button>
        </div>
      </div>
    </div>,
    root
  );
}

const btnPrimary = (busy: boolean): CSSProperties => ({ display: "flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 });
const btnGhost: CSSProperties = { padding: "10px 16px", borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-navtext)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" };
