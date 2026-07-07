import { useEffect, useState, CSSProperties } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "../LangTheme";
import { useAuth } from "../AuthContext";
import { Icon, IconName } from "../icons";
import { leadsI18n } from "./i18n";
import { LeadRow, LeadStatus, STATUS_META, TEMP_META, hasVal, waLink, scoreBreakdown } from "./model";
import { updateLeadStatus, fetchNotes, addNote, LeadNote } from "./useLeads";

const STATUSES: LeadStatus[] = ["new", "qualified", "converted"];

export function LeadDrawer({ lead, onClose, onChanged }: { lead: LeadRow | null; onClose: () => void; onChanged: () => void }) {
  const { lang } = useLang();
  const { account } = useAuth();
  const L = leadsI18n[lang];
  const open = !!lead;

  const [status, setStatus] = useState<LeadStatus>("new");
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verify, setVerify] = useState<{ email: { status: string }; phone: { status: string }; website: { status: string } } | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [emailOverride, setEmailOverride] = useState<string | null>(null);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);

  useEffect(() => {
    if (lead) {
      setStatus(lead.status);
      setNoteInput("");
      setVerify(null);
      setEmailOverride(null);
      setEnrichMsg(null);
      fetchNotes(lead.id).then(setNotes).catch(() => setNotes([]));
    }
  }, [lead]);

  async function runEnrich() {
    if (!lead) return;
    setEnriching(true); setEnrichMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-emails", { body: { leadIds: [lead.id] } });
      if (error || data?.error) { setEnrichMsg(EN[lang].fail); return; }
      if ((data.enriched ?? 0) > 0 && data.sample?.[0]?.email) {
        setEmailOverride(data.sample[0].email);
        onChanged();
      } else {
        setEnrichMsg(EN[lang].none);
      }
    } catch { setEnrichMsg(EN[lang].fail); }
    finally { setEnriching(false); }
  }

  async function runVerify() {
    if (!lead) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-lead", { body: { leadId: lead.id } });
      if (!error && data && !data.error) setVerify(data);
    } finally { setVerifying(false); }
  }

  async function changeStatus(s: LeadStatus) {
    if (!lead) return;
    setStatus(s);
    try { await updateLeadStatus([lead.id], s, account?.id); onChanged(); } catch { setStatus(lead.status); }
  }

  async function saveNote() {
    if (!lead || !noteInput.trim()) return;
    setBusy(true);
    try {
      await addNote(lead.id, noteInput.trim(), account?.id);
      setNoteInput("");
      setNotes(await fetchNotes(lead.id));
    } finally { setBusy(false); }
  }

  const bd = lead ? scoreBreakdown({ phone: lead.phone, address: lead.address, email: lead.email, website: lead.website, nicheQuality: lead.nicheQuality }) : null;
  const initials = lead ? lead.company.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() : "";
  const tm = lead ? TEMP_META[lead.temp] : null;
  const tempLabel = lead ? L[lead.temp] : "";
  const shownEmail = emailOverride ?? lead?.email ?? null;
  const canEnrich = !!lead && hasVal(lead.website) && !hasVal(shownEmail);

  const breakdownRows = bd ? [
    { label: L.pPhone, on: bd.phone > 0, pts: bd.phone },
    { label: L.pEmail, on: bd.email > 0, pts: bd.email },
    { label: L.pSite, on: bd.website > 0, pts: bd.website },
    { label: L.pAddress, on: bd.address > 0, pts: bd.address },
    { label: L.pNiche, on: bd.niche > 0, pts: bd.niche },
  ] : [];

  const target = (typeof document !== "undefined" && document.querySelector(".ml-root")) as HTMLElement | null;
  const node = (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,17,40,.5)", backdropFilter: open ? "blur(3px)" : "none", zIndex: 50, transition: "opacity .28s", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }} />
      <aside className="ml-scroll" style={{ position: "fixed", top: 0, right: 0, height: "100vh", width: "min(480px,94vw)", background: "var(--ml-bg)", borderLeft: "1px solid var(--ml-border)", zIndex: 51, boxShadow: "-18px 0 50px rgba(20,17,40,.16)", transition: "transform .32s cubic-bezier(.4,0,.2,1)", transform: open ? "translateX(0)" : "translateX(105%)", overflowY: "auto", padding: 22 }}>
        {lead && (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ width: 54, height: 54, borderRadius: 15, background: "linear-gradient(135deg,#6d5cf5,#9d7bff)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 19, flexShrink: 0 }}>{initials}</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{lead.company}</div>
                  <div style={{ fontSize: 13, color: "var(--ml-muted)", marginTop: 3 }}>{lead.industry || "—"}{lead.location ? ` · ${lead.location}` : ""}</div>
                </div>
              </div>
              <button onClick={onClose} style={iconBtn}><Icon name="x" size={17} strokeWidth={2.2} /></button>
            </div>

            {/* status */}
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {STATUSES.map((s) => {
                const on = status === s;
                const meta = STATUS_META[s];
                return (
                  <button key={s} onClick={() => changeStatus(s)} style={{ flex: 1, padding: "9px 0", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", border: `1px solid ${on ? meta.color : "var(--ml-border)"}`, background: on ? meta.color : "var(--ml-card)", color: on ? "#fff" : "var(--ml-text)" }}>{L[s]}</button>
                );
              })}
            </div>

            {/* score + breakdown */}
            <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 16, padding: 18, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ml-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{L.whyScore}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: tm?.color }}>{lead.score}<span style={{ fontSize: 12, color: "var(--ml-muted)", fontWeight: 600 }}>/100</span></div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {breakdownRows.map((r) => (
                  <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, color: r.on ? "var(--ml-text)" : "var(--ml-muted)" }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: r.on ? "var(--ml-green)" : "var(--ml-border)" }} />
                      {r.label}
                    </span>
                    <span style={{ fontWeight: 700, color: r.on ? "var(--ml-green)" : "var(--ml-muted)" }}>{r.on ? "+" : ""}{r.pts}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* contatos */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: canEnrich || emailOverride ? 10 : 18 }}>
              <ContactRow icon="phone" value={lead.phone} />
              <ContactRow icon="mail" value={shownEmail} />
              <ContactRow icon="globe" value={lead.website} />
              <ContactRow icon="mapPin" value={lead.address} />
            </div>

            {/* buscar e-mail no site (grátis) */}
            {(canEnrich || emailOverride) && (
              <div style={{ marginBottom: 18 }}>
                {emailOverride ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--ml-green)", background: "rgba(16,185,129,.1)", padding: "9px 12px", borderRadius: 10 }}>
                    <Icon name="check" size={14} /> {EN[lang].ok}
                  </div>
                ) : (
                  <>
                    <button onClick={runEnrich} disabled={enriching} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", justifyContent: "center", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--ml-primary)", background: "rgba(109,92,245,.08)", color: "var(--ml-primary)", fontWeight: 600, fontSize: 13, cursor: enriching ? "default" : "pointer" }}>
                      {enriching ? <Icon name="loader" size={14} className="ml-spin" /> : <Icon name="search" size={14} />}{enriching ? EN[lang].searching : EN[lang].find}
                    </button>
                    {enrichMsg && <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--ml-muted)", textAlign: "center" }}>{enrichMsg}</div>}
                  </>
                )}
              </div>
            )}

            {/* verificação */}
            <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 16, padding: 16, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: verify ? 12 : 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ml-navtext)" }}>{VDICT[lang].title}</div>
                <button onClick={runVerify} disabled={verifying} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-primary)", fontWeight: 600, fontSize: 12.5, cursor: verifying ? "default" : "pointer" }}>
                  {verifying ? <Icon name="loader" size={13} className="ml-spin" /> : <Icon name="check" size={13} />}{VDICT[lang].run}
                </button>
              </div>
              {verify && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <VerifyBadge label={VDICT[lang].email} status={verify.email.status} lang={lang} />
                  <VerifyBadge label={VDICT[lang].phone} status={verify.phone.status} lang={lang} />
                  <VerifyBadge label={VDICT[lang].site} status={verify.website.status} lang={lang} />
                </div>
              )}
            </div>

            {/* ações */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 20 }}>
              <Action icon="chat" label={L.whatsapp} color="var(--ml-green)" filled href={hasVal(lead.phone) ? waLink(lead.phone!, `Olá ${lead.company}`) : undefined} />
              <Action icon="phone" label={L.call} color="var(--ml-blue)" href={hasVal(lead.phone) ? `tel:${lead.phone!.replace(/\s/g, "")}` : undefined} />
              <Action icon="mail" label={L.sendEmail} color="var(--ml-primary)" href={hasVal(shownEmail) ? `mailto:${shownEmail}` : undefined} />
              <Action icon="globe" label={L.site} color="var(--ml-amber)" href={hasVal(lead.website) ? (lead.website!.startsWith("http") ? lead.website! : `https://${lead.website}`) : undefined} />
            </div>

            {/* notas */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{L.notes}</div>
              <textarea value={noteInput} onChange={(e) => setNoteInput(e.target.value)} placeholder={L.notePh} rows={2}
                style={{ width: "100%", padding: 11, borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", fontSize: 13.5, resize: "vertical", outline: "none" }} />
              <button onClick={saveNote} disabled={busy || !noteInput.trim()} style={{ marginTop: 8, padding: "9px 16px", borderRadius: 10, border: "none", background: "var(--ml-primary)", color: "#fff", fontWeight: 600, fontSize: 13.5, cursor: busy || !noteInput.trim() ? "default" : "pointer", opacity: busy || !noteInput.trim() ? 0.6 : 1 }}>{L.save}</button>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
                {notes.length === 0 && <div style={{ fontSize: 13, color: "var(--ml-muted)" }}>{L.noNotes}</div>}
                {notes.map((n) => (
                  <div key={n.id} style={{ background: "var(--ml-grid)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ fontSize: 13.5, color: "var(--ml-text)", whiteSpace: "pre-wrap" }}>{n.body}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ml-muted)", marginTop: 4 }}>{new Date(n.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
  return target ? createPortal(node, target) : node;
}

function ContactRow({ icon, value }: { icon: IconName; value: string | null }) {
  const present = hasVal(value);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 2px", fontSize: 13.5 }}>
      <span style={{ color: present ? "var(--ml-primary)" : "var(--ml-muted)" }}><Icon name={icon} size={16} /></span>
      <span style={{ color: present ? "var(--ml-text)" : "var(--ml-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{present ? value : "—"}</span>
    </div>
  );
}

function Action({ icon, label, color, href, filled }: { icon: IconName; label: string; color: string; href?: string; filled?: boolean }) {
  const disabled = !href;
  const useFilled = filled && !disabled;
  const style: CSSProperties = {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 4px", borderRadius: 14,
    border: useFilled ? "none" : "1px solid var(--ml-border)", fontSize: 11.5, fontWeight: 700, textDecoration: "none",
    color: useFilled ? "#fff" : disabled ? "var(--ml-muted)" : color, background: useFilled ? "#25d366" : "var(--ml-card)",
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
    boxShadow: useFilled ? "0 6px 14px rgba(37,211,102,.28)" : undefined,
  };
  if (disabled) return <div style={style}><Icon name={icon} size={17} />{label}</div>;
  return <a href={href} target="_blank" rel="noreferrer" style={style}><Icon name={icon} size={17} />{label}</a>;
}

const iconBtn: CSSProperties = { width: 34, height: 34, borderRadius: 10, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 };

const EN = {
  pt: { find: "Buscar e-mail no site", searching: "Buscando…", ok: "E-mail encontrado e salvo!", none: "Nenhum e-mail encontrado no site.", fail: "Não foi possível buscar agora." },
  en: { find: "Find email on website", searching: "Searching…", ok: "Email found and saved!", none: "No email found on the website.", fail: "Couldn't search right now." },
  es: { find: "Buscar email en el sitio", searching: "Buscando…", ok: "¡Email encontrado y guardado!", none: "No se encontró email en el sitio.", fail: "No se pudo buscar ahora." },
};

const VDICT = {
  pt: { title: "Verificação de dados", run: "Verificar", email: "E-mail", phone: "Telefone", site: "Site",
    st: { valid: "Válido", invalid: "Inválido", no_mx: "Sem MX", online: "No ar", offline: "Fora do ar", missing: "Ausente" } as Record<string, string> },
  en: { title: "Data verification", run: "Verify", email: "Email", phone: "Phone", site: "Site",
    st: { valid: "Valid", invalid: "Invalid", no_mx: "No MX", online: "Online", offline: "Offline", missing: "Missing" } as Record<string, string> },
  es: { title: "Verificación de datos", run: "Verificar", email: "Email", phone: "Teléfono", site: "Sitio",
    st: { valid: "Válido", invalid: "Inválido", no_mx: "Sin MX", online: "En línea", offline: "Caído", missing: "Ausente" } as Record<string, string> },
};

function VerifyBadge({ label, status, lang }: { label: string; status: string; lang: "pt" | "en" | "es" }) {
  const good = status === "valid" || status === "online";
  const bad = status === "invalid" || status === "offline";
  const color = good ? "var(--ml-green)" : bad ? "var(--ml-red)" : "var(--ml-amber)";
  const bg = good ? "rgba(16,185,129,.12)" : bad ? "rgba(239,68,68,.1)" : "rgba(245,158,11,.12)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 20, background: bg, fontSize: 12 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
      <span style={{ color: "var(--ml-text)", fontWeight: 600 }}>{label}</span>
      <span style={{ color, fontWeight: 700 }}>{VDICT[lang].st[status] ?? status}</span>
    </span>
  );
}
