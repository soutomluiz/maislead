import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useLang } from "../LangTheme";
import { useAuth } from "../AuthContext";
import { useLeads } from "../leads/useLeads";
import { fetchAppointments, createAppointment, setCrmStage, type Appointment } from "./data";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return { y, m: m - 1, d }; };

export function AgendaScreen() {
  const { t } = useLang();
  const { account } = useAuth();
  const { leads } = useLeads();
  const A = t.agenda;

  const today = useMemo(() => new Date(), []);
  const [cal, setCal] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [appts, setAppts] = useState<Appointment[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ leadId: "", date: "", time: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!account?.id) return;
    try { setAppts(await fetchAppointments(account.id)); } catch { /* ignore */ }
  }, [account?.id]);
  useEffect(() => { load(); }, [load]);

  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dayMs = 86400000;
  const stats = useMemo(() => {
    let todayN = 0, weekN = 0, pending = 0;
    for (const a of appts) {
      const { y, m, d } = parse(a.appt_date);
      const dt = new Date(y, m, d);
      const diff = (dt.getTime() - t0.getTime()) / dayMs;
      if (diff === 0) todayN++;
      if (diff >= 0 && diff < 7) weekN++;
      if (diff >= 0) pending++;
    }
    return { todayN, weekN, pending };
  }, [appts, t0]);

  const firstDow = new Date(cal.y, cal.m, 1).getDay();
  const daysInMonth = new Date(cal.y, cal.m + 1, 0).getDate();
  const cells: { day: number | null; date?: string; isToday?: boolean; appts: Appointment[] }[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, appts: [] });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = iso(cal.y, cal.m, d);
    const isToday = cal.y === today.getFullYear() && cal.m === today.getMonth() && d === today.getDate();
    const dayAppts = appts.filter((a) => a.appt_date === date).sort((x, y) => (x.appt_time ?? "") < (y.appt_time ?? "") ? -1 : 1);
    cells.push({ day: d, date, isToday, appts: dayAppts });
  }

  function shift(delta: number) {
    setCal((c) => { const nm = c.m + delta; return { y: c.y + Math.floor(nm / 12) - (nm < 0 ? 1 : 0), m: ((nm % 12) + 12) % 12 }; });
  }
  function openFor(date?: string) { setForm({ leadId: "", date: date ?? "", time: "", notes: "" }); setOpen(true); }

  async function create() {
    if (!account?.id || !form.leadId || !form.date) return;
    setSaving(true);
    try {
      await createAppointment({ accountId: account.id, leadId: form.leadId, date: form.date, time: form.time || null, notes: form.notes || null });
      // Ao agendar, move o lead para "Agendado" (não rebaixa quem já converteu/perdeu).
      const lead = leads.find((l) => l.id === form.leadId);
      if (lead && lead.crmStage !== "won" && lead.crmStage !== "lost" && lead.crmStage !== "scheduled") {
        await setCrmStage(form.leadId, "scheduled", account.id);
      }
      setOpen(false);
      await load();
    } finally { setSaving(false); }
  }

  const statCard = (value: number, label: string, color: string) => (
    <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 18, padding: "20px 22px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 1px 3px rgba(30,25,60,.04)" }}>
      <div style={{ fontSize: 34, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 14, color: "var(--ml-muted)", fontWeight: 600 }}>{label}</div>
    </div>
  );
  const navBtn: CSSProperties = { width: 34, height: 34, borderRadius: 9, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
  const canCreate = !!form.leadId && !!form.date;

  return (
    <div className="ml-fade">
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => openFor()} style={{ height: 44, padding: "0 20px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#4c2ee0,#6d4bff)", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 8px 20px rgba(76,46,224,.3)" }}>{A.newAppt}</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 18 }}>
        {statCard(stats.todayN, A.today, "#4c2ee0")}
        {statCard(stats.weekN, A.week, "#3b82f6")}
        {statCard(stats.pending, A.pending, "#f59e0b")}
      </div>

      <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 20, padding: 22, boxShadow: "0 1px 3px rgba(30,25,60,.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => shift(-1)} style={navBtn}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m15 18-6-6 6-6" /></svg></button>
            <div style={{ fontSize: 17, fontWeight: 800, minWidth: 150, textAlign: "center" }}>{A.months[cal.m]} {cal.y}</div>
            <button onClick={() => shift(1)} style={navBtn}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m9 18 6-6-6-6" /></svg></button>
            <button onClick={() => setCal({ y: today.getFullYear(), m: today.getMonth() })} style={{ height: 34, padding: "0 14px", borderRadius: 9, border: "none", background: "rgba(76,46,224,.1)", color: "#4c2ee0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{A.todayBtn}</button>
          </div>
          <div style={{ display: "flex", border: "1px solid var(--ml-border)", borderRadius: 10, overflow: "hidden", height: 36 }}>
            <button style={{ padding: "0 16px", border: "none", background: "#4c2ee0", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{A.month}</button>
            <button disabled style={{ padding: "0 16px", border: "none", borderLeft: "1px solid var(--ml-border)", background: "transparent", color: "var(--ml-muted)", fontSize: 13, fontWeight: 600, cursor: "not-allowed" }}>{A.wk}</button>
            <button disabled style={{ padding: "0 16px", border: "none", borderLeft: "1px solid var(--ml-border)", background: "transparent", color: "var(--ml-muted)", fontSize: 13, fontWeight: 600, cursor: "not-allowed" }}>{A.day}</button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
          {A.dows.map((d) => (
            <div key={d} style={{ textAlign: "center", fontSize: 11.5, fontWeight: 700, color: "var(--ml-muted)", textTransform: "uppercase", letterSpacing: ".05em", paddingBottom: 8 }}>{d}</div>
          ))}
          {cells.map((c, i) => c.day == null ? (
            <div key={`e${i}`} style={{ minHeight: 96, borderRadius: 11, border: "1px solid transparent" }} />
          ) : (
            <div key={c.date} onClick={() => openFor(c.date)}
              style={{ minHeight: 96, borderRadius: 11, border: `1px solid ${c.isToday ? "#4c2ee0" : "var(--ml-border)"}`, padding: 8, background: c.isToday ? "rgba(76,46,224,.07)" : "var(--ml-input)", cursor: "pointer" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: c.isToday ? "#4c2ee0" : undefined }}>{c.day}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 5 }}>
                {c.appts.map((a) => (
                  <div key={a.id} title={a.notes ?? undefined} style={{ fontSize: 10.5, fontWeight: 600, background: "rgba(76,46,224,.12)", color: "#4c2ee0", borderRadius: 6, padding: "3px 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {(a.appt_time ? a.appt_time + " " : "") + (a.company ?? "—")}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {open && (
        <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 86, background: "rgba(20,17,40,.55)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: "94vw", background: "var(--ml-card)", borderRadius: 20, boxShadow: "0 30px 70px rgba(20,17,40,.4)", overflow: "hidden", animation: "mlModalIn .25s ease" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 24px", borderBottom: "1px solid var(--ml-border)" }}>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{A.title}</div>
              <button onClick={() => setOpen(false)} style={{ width: 32, height: 32, borderRadius: 9, border: "none", background: "var(--ml-grid)", color: "var(--ml-muted)", cursor: "pointer", fontSize: 17 }}>×</button>
            </div>
            <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              <Labeled label={A.lead}>
                <select value={form.leadId} onChange={(e) => setForm((f) => ({ ...f, leadId: e.target.value }))} style={selStyle}>
                  <option value="">{A.leadPh}</option>
                  {leads.map((l) => <option key={l.id} value={l.id}>{l.company}{l.location ? ` · ${l.location}` : ""}</option>)}
                </select>
              </Labeled>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1.4 }}><Labeled label={A.date}><input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} style={selStyle} /></Labeled></div>
                <div style={{ flex: 1 }}><Labeled label={A.time}><input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} style={selStyle} /></Labeled></div>
              </div>
              <Labeled label={`${A.notes} ${A.notesOpt}`}>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder={A.notesPh}
                  style={{ ...selStyle, height: 70, padding: "10px 12px", resize: "none", lineHeight: 1.5 }} />
              </Labeled>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={() => setOpen(false)} style={{ height: 46, padding: "0 20px", border: "1px solid var(--ml-border)", borderRadius: 12, background: "var(--ml-card)", color: "var(--ml-muted)", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{A.cancel}</button>
                <button onClick={create} disabled={!canCreate || saving}
                  style={{ flex: 1, height: 46, border: "none", borderRadius: 12, background: "linear-gradient(135deg,#4c2ee0,#6d4bff)", color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: canCreate && !saving ? "pointer" : "not-allowed", opacity: canCreate && !saving ? 1 : 0.5, boxShadow: "0 8px 20px rgba(76,46,224,.3)" }}>{A.confirm}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".06em", color: "var(--ml-muted)", textTransform: "uppercase", marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  );
}

const selStyle: CSSProperties = { width: "100%", height: 46, borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", padding: "0 12px", fontSize: 14, outline: "none" };
