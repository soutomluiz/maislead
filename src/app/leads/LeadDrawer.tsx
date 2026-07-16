import { useEffect, useState, CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CenterModal } from "../CenterModal";
import { useLang } from "../LangTheme";
import { useAuth } from "../AuthContext";
import { Icon, IconName } from "../icons";
import { leadsI18n } from "./i18n";
import { LeadRow, LeadStatus, STATUS_META, TEMP_META, hasVal, waLink, telLink, fillTemplate, followInfo, FOLLOW_META, scoreBreakdown, reputationRisk, type TechInfo } from "./model";
import { updateLeadStatus, fetchNotes, addNote, LeadNote } from "./useLeads";
import {
  fetchDocuments, uploadDocument, documentUrl, deleteDocument, type LeadDoc,
  fetchLinks, addLink as addLeadLink, deleteLink, type LeadLink,
  fetchActivities, addActivity, CHANNEL_COLOR, type Activity, type Channel,
  setNextFollowUp,
} from "../crm/data";
import { TechChips } from "./DetectTechModal";
import { techOpportunities } from "./techInsights";
import { PitchPanel } from "./PitchPanel";
import { usePlan, upsellText, minPlanLabel, type Feature } from "../plan";

const STATUSES: LeadStatus[] = ["new", "qualified", "converted"];
type LeadTab = "detalhes" | "docs" | "links" | "followup";

export function LeadDrawer({ lead, onClose, onChanged }: { lead: LeadRow | null; onClose: () => void; onChanged: () => void }) {
  const { lang, t } = useLang();
  const { account, profile } = useAuth();
  const { can } = usePlan();
  const L = leadsI18n[lang];
  const minhaEmpresa = (profile as { company_name?: string | null })?.company_name?.trim() || (account?.name && account.name !== "Minha conta" ? account.name.trim() : "");

  const [tab, setTab] = useState<LeadTab>("detalhes");
  const [docs, setDocs] = useState<LeadDoc[]>([]);
  const [links, setLinks] = useState<LeadLink[]>([]);
  const [acts, setActs] = useState<Activity[]>([]);
  const [fuDate, setFuDate] = useState<string>("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkNote, setLinkNote] = useState("");
  const [logChannel, setLogChannel] = useState<Channel>("whatsapp");
  const [logNote, setLogNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<LeadStatus>("new");
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verify, setVerify] = useState<{ email: { status: string }; phone: { status: string }; website: { status: string } } | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [emailOverride, setEmailOverride] = useState<string | null>(null);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [techOverride, setTechOverride] = useState<TechInfo | null>(null);
  const [techMsg, setTechMsg] = useState<string | null>(null);

  useEffect(() => {
    if (lead) {
      setStatus(lead.status);
      setNoteInput("");
      setVerify(null);
      setEmailOverride(null);
      setEnrichMsg(null);
      setTechOverride(null);
      setTechMsg(null);
      setTab("detalhes");
      setLinkUrl(""); setLinkNote(""); setLogNote(""); setLogChannel("whatsapp");
      setFuDate(lead.nextFollowUpAt ? lead.nextFollowUpAt.slice(0, 10) : "");
      fetchNotes(lead.id).then(setNotes).catch(() => setNotes([]));
      fetchDocuments(lead.id).then(setDocs).catch(() => setDocs([]));
      fetchLinks(lead.id).then(setLinks).catch(() => setLinks([]));
      fetchActivities(lead.id).then(setActs).catch(() => setActs([]));
    }
  }, [lead]);

  async function changeFollowUp(value: string | null) {
    if (!lead) return;
    setFuDate(value ?? "");
    try { await setNextFollowUp(lead.id, value); onChanged(); } catch { /* ignore */ }
  }
  const shiftFollowUp = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    changeFollowUp(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  };

  async function onUploadDocs(files: FileList | null) {
    if (!lead || !account?.id || !files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        const doc = await uploadDocument(f, lead.id, account.id);
        setDocs((prev) => [doc, ...prev]);
      }
    } catch { /* ignore */ } finally { setUploading(false); }
  }
  async function openDoc(d: LeadDoc) { if (!d.path) return; const url = await documentUrl(d.path); if (url) window.open(url, "_blank"); }
  async function removeDoc(d: LeadDoc) { try { await deleteDocument(d.id, d.path); setDocs((prev) => prev.filter((x) => x.id !== d.id)); } catch { /* ignore */ } }

  async function submitLink() {
    if (!lead || !account?.id || !linkUrl.trim()) return;
    try {
      const lk = await addLeadLink(lead.id, account.id, linkUrl, linkNote);
      setLinks((prev) => [lk, ...prev]); setLinkUrl(""); setLinkNote("");
    } catch { /* ignore */ }
  }
  async function removeLink(id: string) { try { await deleteLink(id); setLinks((prev) => prev.filter((x) => x.id !== id)); } catch { /* ignore */ } }

  async function submitLog() {
    if (!lead || !account?.id) return;
    try {
      const a = await addActivity(lead.id, account.id, logChannel, logNote);
      setActs((prev) => [a, ...prev]); setLogNote("");
    } catch { /* ignore */ }
  }
  // Registra automaticamente uma activity ao acionar WhatsApp/Ligar (spec item 6).
  function logContact(channel: Channel, seed: string) {
    if (!lead || !account?.id) return;
    addActivity(lead.id, account.id, channel, seed).then((a) => setActs((prev) => [a, ...prev])).catch(() => { /* ignore */ });
  }

  async function runEnrich() {
    if (!lead) return;
    setEnriching(true); setEnrichMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-emails", { body: { leadIds: [lead.id] } });
      if (error || data?.error) { setEnrichMsg(EN[lang].fail); return; }
      const foundEmail = data.results?.[0]?.email ?? null;
      if (((data.found ?? data.enriched) ?? 0) > 0 && foundEmail) {
        setEmailOverride(foundEmail);
        onChanged();
      } else {
        setEnrichMsg(EN[lang].none);
      }
    } catch { setEnrichMsg(EN[lang].fail); }
    finally { setEnriching(false); }
  }

  async function runDetectTech() {
    if (!lead) return;
    setDetecting(true); setTechMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke("detect-tech", { body: { leadIds: [lead.id], redetect: true } });
      if (error || data?.error) { setTechMsg(TD[lang].fail); return; }
      const t = (data.results?.[0]?.tech ?? null) as TechInfo | null;
      if (t && t.ok) { setTechOverride(t); onChanged(); }
      else setTechMsg(TD[lang].fail);
    } catch { setTechMsg(TD[lang].fail); }
    finally { setDetecting(false); }
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
  const shownTech = techOverride ?? lead?.tech ?? null;
  const canDetectTech = !!lead && hasVal(lead.website);

  const breakdownRows = bd ? [
    { label: L.pPhone, on: bd.phone > 0, pts: bd.phone },
    { label: L.pEmail, on: bd.email > 0, pts: bd.email },
    { label: L.pSite, on: bd.website > 0, pts: bd.website },
    { label: L.pAddress, on: bd.address > 0, pts: bd.address },
    { label: L.pNiche, on: bd.niche > 0, pts: bd.niche },
  ] : [];

  if (!lead) return null;
  return (
    <CenterModal onClose={onClose} width={780}>
      <div style={{ padding: 26 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ width: 54, height: 54, borderRadius: 15, background: "linear-gradient(135deg,#4c2ee0,#6d4bff)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 19, flexShrink: 0 }}>{initials}</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{lead.company}</div>
                  <div style={{ fontSize: 13, color: "var(--ml-muted)", marginTop: 3 }}>{lead.industry || "—"}{lead.location ? ` · ${lead.location}` : ""}</div>
                </div>
              </div>
              <button onClick={onClose} style={iconBtn}><Icon name="x" size={17} strokeWidth={2.2} /></button>
            </div>

            {/* abas */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--ml-border)", marginBottom: 18, gap: 22 }}>
              {([
                { key: "detalhes", label: t.lead.tabDetails },
                { key: "docs", label: t.docs.tab + (docs.length ? ` (${docs.length})` : "") },
                { key: "links", label: t.links.tab + (links.length ? ` (${links.length})` : "") },
                { key: "followup", label: t.fulog.tab },
              ] as { key: LeadTab; label: string }[]).map((tb) => {
                const on = tab === tb.key;
                return (
                  <button key={tb.key} onClick={() => setTab(tb.key)}
                    style={{ position: "relative", background: "none", border: "none", padding: "12px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", color: on ? "var(--ml-text)" : "var(--ml-muted)" }}>
                    {tb.label}
                    <span style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 2, borderRadius: "2px 2px 0 0", background: on ? "var(--ml-primary)" : "transparent" }} />
                  </button>
                );
              })}
            </div>

            {tab === "detalhes" && (<>
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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, alignItems: "start" }}>
              <div>
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
                ) : !can("enrich") ? (
                  <LockPill feature="enrich" lang={lang} full />
                ) : (
                  <>
                    <button onClick={runEnrich} disabled={enriching} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", justifyContent: "center", padding: "10px 14px", borderRadius: 10, border: "1px solid var(--ml-primary)", background: "rgba(76,46,224,.08)", color: "var(--ml-primary)", fontWeight: 600, fontSize: 13, cursor: enriching ? "default" : "pointer" }}>
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
                {can("verify") ? (
                <button onClick={runVerify} disabled={verifying} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-primary)", fontWeight: 600, fontSize: 12.5, cursor: verifying ? "default" : "pointer" }}>
                  {verifying ? <Icon name="loader" size={13} className="ml-spin" /> : <Icon name="check" size={13} />}{VDICT[lang].run}
                </button>
                ) : <LockPill feature="verify" lang={lang} />}
              </div>
              {verify && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <VerifyBadge label={VDICT[lang].email} status={verify.email.status} lang={lang} />
                  <VerifyBadge label={VDICT[lang].phone} status={verify.phone.status} lang={lang} />
                  <VerifyBadge label={VDICT[lang].site} status={verify.website.status} lang={lang} />
                </div>
              )}
            </div>

              </div>

              <div>
            {/* reputação (Google Maps) */}
            {lead.rating != null && (
              <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 16, padding: 16, marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ml-navtext)" }}>{RD[lang].title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 800 }}>
                    <Icon name="spark" size={15} style={{ color: "var(--ml-amber)" }} />
                    <span style={{ color: reputationRisk(lead) ? "var(--ml-red)" : "var(--ml-text)" }}>{lead.rating.toFixed(1)}</span>
                    <span style={{ fontSize: 12, color: "var(--ml-muted)", fontWeight: 500 }}>· {lead.reviews ?? 0} {RD[lang].reviews}</span>
                  </div>
                </div>
                {reputationRisk(lead) && (
                  <div style={{ display: "flex", gap: 8, marginTop: 12, fontSize: 12.5, lineHeight: 1.5, color: "var(--ml-text)", background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.22)", borderRadius: 10, padding: "9px 11px" }}>
                    <span style={{ flexShrink: 0, marginTop: 1, color: "#c07f0d" }}><Icon name="trendUp" size={14} /></span>
                    <span>{RD[lang].risk}</span>
                  </div>
                )}
              </div>
            )}

            {/* tecnologia do site */}
            {canDetectTech && (
              <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 16, padding: 16, marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: shownTech ? 12 : 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ml-navtext)" }}>{TD[lang].title}</div>
                  {can("detectTech") ? (
                  <button onClick={runDetectTech} disabled={detecting} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 9, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-primary)", fontWeight: 600, fontSize: 12.5, cursor: detecting ? "default" : "pointer" }}>
                    {detecting ? <Icon name="loader" size={13} className="ml-spin" /> : <Icon name="cpu" size={13} />}{shownTech ? TD[lang].again : TD[lang].run}
                  </button>
                  ) : <LockPill feature="detectTech" lang={lang} />}
                </div>
                {shownTech && <TechChips tech={shownTech} noStack={TD[lang].none} noPixelLabel={TD[lang].noPixel} lang={lang} />}
                {shownTech && (() => {
                  const ops = techOpportunities(shownTech, lang);
                  if (!ops.length) return null;
                  return (
                    <div style={{ marginTop: 14, borderTop: "1px dashed var(--ml-border)", paddingTop: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--ml-primary)", marginBottom: 9 }}>
                        <Icon name="spark" size={13} /> {TD[lang].howToApproach}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {ops.map((o, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, fontSize: 12.5, lineHeight: 1.5, color: "var(--ml-text)", background: o.tone === "gap" ? "rgba(245,158,11,.08)" : "rgba(16,185,129,.08)", border: `1px solid ${o.tone === "gap" ? "rgba(245,158,11,.22)" : "rgba(16,185,129,.2)"}`, borderRadius: 10, padding: "9px 11px" }}>
                            <span style={{ flexShrink: 0, marginTop: 1, color: o.tone === "gap" ? "#c07f0d" : "#059669" }}>
                              <Icon name={o.tone === "gap" ? "trendUp" : "check"} size={14} />
                            </span>
                            <span>{o.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                {techMsg && <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--ml-muted)" }}>{techMsg}</div>}
              </div>
            )}

            {/* IA de abordagem */}
            <PitchPanel leadId={lead.id} lang={lang} />
              </div>
            </div>

            {/* ações */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 20 }}>
              <Action icon="chat" label={L.whatsapp} color="var(--ml-green)" filled
                href={hasVal(lead.phone) ? waLink(lead.phone!, fillTemplate(t.wa.msg, { empresa: lead.company, minhaEmpresa, setor: lead.industry, cidade: lead.location })) : undefined}
                onClick={() => logContact("whatsapp", t.fulog.seedWa)} />
              <Action icon="phone" label={L.call} color="var(--ml-blue)" href={hasVal(lead.phone) ? telLink(lead.phone!) : undefined}
                onClick={() => logContact("call", t.fulog.seedCall)} />
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
            </>)}

            {tab === "docs" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <label style={{ border: "2px dashed var(--ml-border)", borderRadius: 16, padding: "26px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 9, cursor: "pointer", textAlign: "center", background: "var(--ml-card)" }}>
                  <div style={{ width: 46, height: 46, borderRadius: 13, background: "rgba(76,46,224,.12)", color: "#4c2ee0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {uploading ? <Icon name="loader" size={22} className="ml-spin" /> : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ml-text)" }}>{t.docs.dropTitle}</div>
                  <div style={{ fontSize: 12.5, color: "var(--ml-muted)" }}>{t.docs.dropSub}</div>
                  <input type="file" multiple onChange={(e) => onUploadDocs(e.target.files)} style={{ display: "none" }} />
                </label>
                {docs.length === 0 && <div style={{ textAlign: "center", color: "var(--ml-muted)", fontSize: 13, padding: 6 }}>{t.docs.empty}</div>}
                {docs.map((d) => {
                  const m = docExtMeta(d.name, d.mime);
                  return (
                    <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 13, background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 14, padding: "13px 15px" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 11, background: m.bg, color: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 800, flexShrink: 0 }}>{m.ext}</div>
                      <div onClick={() => openDoc(d)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                        <div style={{ fontSize: 11.5, color: "var(--ml-muted)", marginTop: 2 }}>{fmtSize(d.size)} · {new Date(d.created_at).toLocaleDateString()}</div>
                      </div>
                      <button onClick={() => removeDoc(d)} style={removeBtnStyle}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg></button>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "links" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 16, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder={t.links.urlPh} style={{ height: 42, borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", padding: "0 13px", fontSize: 13.5, outline: "none" }} />
                  <textarea value={linkNote} onChange={(e) => setLinkNote(e.target.value)} placeholder={t.links.notePh} style={{ height: 58, borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", padding: "10px 13px", fontSize: 13, outline: "none", resize: "none", lineHeight: 1.5 }} />
                  <button onClick={submitLink} disabled={!linkUrl.trim()} style={{ height: 42, border: "none", borderRadius: 11, background: "linear-gradient(135deg,#4c2ee0,#6d4bff)", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: linkUrl.trim() ? "pointer" : "not-allowed", opacity: linkUrl.trim() ? 1 : 0.6, boxShadow: "0 6px 14px rgba(76,46,224,.22)" }}>{t.links.add}</button>
                </div>
                {links.length === 0 && <div style={{ textAlign: "center", color: "var(--ml-muted)", fontSize: 13, padding: 6 }}>{t.links.empty}</div>}
                {links.map((lk) => (
                  <div key={lk.id} style={{ display: "flex", alignItems: "flex-start", gap: 11, background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 14, padding: "13px 15px" }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(59,130,246,.12)", color: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <a href={lk.url} target="_blank" rel="noreferrer" style={{ fontSize: 13.5, fontWeight: 700, color: "#4c2ee0", textDecoration: "none", wordBreak: "break-all" }}>{lk.url}</a>
                      {lk.note && <div style={{ fontSize: 12.5, color: "var(--ml-muted)", marginTop: 3, lineHeight: 1.5 }}>{lk.note}</div>}
                      <div style={{ fontSize: 11, color: "var(--ml-muted)", marginTop: 4 }}>{new Date(lk.created_at).toLocaleDateString()}</div>
                    </div>
                    <button onClick={() => removeLink(lk.id)} style={removeBtnStyle}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
                  </div>
                ))}
              </div>
            )}

            {tab === "followup" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 16, padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ml-muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>{t.fup.nextTitle}</div>
                    {(() => {
                      const fi = followInfo(fuDate || null);
                      const fm = FOLLOW_META[fi.state];
                      const label = !fi.has ? t.fup.notSet : fi.state === "late" ? `${t.fup.late} ${fi.days}d` : fi.state === "today" ? t.fup.todayLbl : `${t.fup.inLbl} ${fi.days}d`;
                      return (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 800, color: fi.has ? fm.color : "var(--ml-muted)", background: fi.has ? fm.bg : "var(--ml-grid)", padding: "4px 11px", borderRadius: 20, animation: fi.has && fm.pulse ? "mlFuPulse 1.4s ease-in-out infinite" : undefined }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>{label}
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <input type="date" value={fuDate} onChange={(e) => changeFollowUp(e.target.value || null)} style={{ flex: 1, height: 44, borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", padding: "0 13px", fontSize: 13.5, outline: "none" }} />
                    <button onClick={() => changeFollowUp(null)} title={t.fup.clearDone} style={{ width: 44, height: 44, borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "#10b981", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M20 6 9 17l-5-5" /></svg></button>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    {[{ n: 1, l: t.fup.tomorrow }, { n: 3, l: t.fup.p3 }, { n: 7, l: t.fup.p7 }].map((b) => (
                      <button key={b.n} onClick={() => shiftFollowUp(b.n)} style={{ flex: 1, height: 34, borderRadius: 9, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{b.l}</button>
                    ))}
                  </div>
                </div>

                <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 16, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ml-muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>{t.fulog.addTitle}</div>
                  <div style={{ display: "flex", gap: 9 }}>
                    <select value={logChannel} onChange={(e) => setLogChannel(e.target.value as Channel)} style={{ height: 42, borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", padding: "0 11px", fontSize: 13, outline: "none", minWidth: 132 }}>
                      <option value="whatsapp">{t.fulog.channels.whatsapp}</option>
                      <option value="call">{t.fulog.channels.call}</option>
                      <option value="email">{t.fulog.channels.email}</option>
                      <option value="meeting">{t.fulog.channels.meeting}</option>
                    </select>
                    <button onClick={submitLog} style={{ flex: 1, height: 42, border: "none", borderRadius: 11, background: "#211d3b", color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>{t.fulog.register}</button>
                  </div>
                  <textarea value={logNote} onChange={(e) => setLogNote(e.target.value)} placeholder={t.fulog.notePh} style={{ height: 58, borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", padding: "10px 13px", fontSize: 13, outline: "none", resize: "none", lineHeight: 1.5 }} />
                </div>

                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ml-muted)", textTransform: "uppercase", letterSpacing: ".05em", padding: "2px 2px 0" }}>{t.fulog.history}</div>
                {acts.length === 0 && <div style={{ textAlign: "center", color: "var(--ml-muted)", fontSize: 13, padding: 6 }}>{t.fulog.empty}</div>}
                {acts.map((ev) => (
                  <div key={ev.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 11, height: 11, borderRadius: "50%", background: CHANNEL_COLOR[ev.channel], marginTop: 5, flexShrink: 0, boxShadow: "0 0 0 3px rgba(0,0,0,.04)" }} />
                    <div style={{ flex: 1, minWidth: 0, background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 13, padding: "11px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{t.fulog.channels[ev.channel]}</span>
                        <span style={{ fontSize: 11.5, color: "var(--ml-muted)" }}>{new Date(ev.created_at).toLocaleString()}</span>
                      </div>
                      {ev.note && <div style={{ fontSize: 12.5, color: "var(--ml-muted)", marginTop: 4, lineHeight: 1.5 }}>{ev.note}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
      </div>
    </CenterModal>
  );
}

const removeBtnStyle: CSSProperties = { width: 32, height: 32, borderRadius: 9, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

function fmtSize(bytes: number | null): string {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function docExtMeta(name: string, mime: string | null): { ext: string; bg: string; color: string } {
  const ext = (name.split(".").pop() || "").toUpperCase();
  const isImg = /^image\//.test(mime || "") || ["PNG", "JPG", "JPEG", "GIF", "WEBP", "SVG", "BMP"].includes(ext);
  if (ext === "PDF") return { ext: "PDF", bg: "rgba(239,68,68,.12)", color: "#ef4444" };
  if (["DOC", "DOCX"].includes(ext)) return { ext, bg: "rgba(59,130,246,.12)", color: "#3b82f6" };
  if (["XLS", "XLSX", "CSV"].includes(ext)) return { ext, bg: "rgba(16,185,129,.12)", color: "#10b981" };
  if (isImg) return { ext: ext || "IMG", bg: "rgba(76,46,224,.12)", color: "#4c2ee0" };
  return { ext: ext || "FILE", bg: "rgba(76,46,224,.12)", color: "#4c2ee0" };
}

function LockPill({ feature, lang, full }: { feature: Feature; lang: "pt" | "en" | "es"; full?: boolean }) {
  const label = minPlanLabel(feature);
  return (
    <span
      title={upsellText(feature, lang)}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--ml-primary)", background: "rgba(76,46,224,.1)", padding: "7px 12px", borderRadius: 9, width: full ? "100%" : undefined, cursor: "help" }}
    >
      <Icon name={label === "Business" ? "crown" : "lock"} size={13} /> {label}
    </span>
  );
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

function Action({ icon, label, color, href, filled, onClick }: { icon: IconName; label: string; color: string; href?: string; filled?: boolean; onClick?: () => void }) {
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
  return <a href={href} target="_blank" rel="noreferrer" onClick={onClick} style={style}><Icon name={icon} size={17} />{label}</a>;
}

const iconBtn: CSSProperties = { width: 34, height: 34, borderRadius: 10, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 };

const EN = {
  pt: { find: "Buscar e-mail no site", searching: "Buscando…", ok: "E-mail encontrado e salvo!", none: "Nenhum e-mail encontrado no site.", fail: "Não foi possível buscar agora." },
  en: { find: "Find email on website", searching: "Searching…", ok: "Email found and saved!", none: "No email found on the website.", fail: "Couldn't search right now." },
  es: { find: "Buscar email en el sitio", searching: "Buscando…", ok: "¡Email encontrado y guardado!", none: "No se encontró email en el sitio.", fail: "No se pudo buscar ahora." },
};

const RD = {
  pt: { title: "Reputação (Google)", reviews: "avaliações", risk: "Reputação em risco: a nota baixa afasta clientes. Ofereça gestão de reputação e captação de avaliações positivas." },
  en: { title: "Reputation (Google)", reviews: "reviews", risk: "Reputation at risk: a low rating drives customers away. Offer reputation management and positive-review generation." },
  es: { title: "Reputación (Google)", reviews: "reseñas", risk: "Reputación en riesgo: la nota baja aleja clientes. Ofrece gestión de reputación y captación de reseñas positivas." },
};

const TD = {
  pt: { title: "Tecnologia do site", run: "Detectar", again: "Refazer", none: "Nada reconhecido", noPixel: "sem Pixel", fail: "Não foi possível analisar o site.", howToApproach: "Como abordar" },
  en: { title: "Website tech", run: "Detect", again: "Redo", none: "Nothing recognized", noPixel: "no Pixel", fail: "Couldn't analyze the website.", howToApproach: "How to approach" },
  es: { title: "Tecnología del sitio", run: "Detectar", again: "Rehacer", none: "Nada reconocido", noPixel: "sin Pixel", fail: "No se pudo analizar el sitio.", howToApproach: "Cómo abordar" },
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
