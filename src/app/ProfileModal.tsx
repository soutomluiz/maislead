import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "./LangTheme";
import { useAuth } from "./AuthContext";
import { Icon } from "./icons";

const DICT = {
  pt: { name: "Nome completo", company: "Empresa", required: "obrigatório", companyPh: "Nome da sua empresa", email: "E-mail", phone: "Telefone", location: "Localização", bio: "Biografia", bioPh: "Conte um pouco sobre você...", save: "Salvar Alterações", saved: "Perfil atualizado!", err: "Erro ao salvar", cancel: "Cancelar", leads: "Leads", withPhone: "Com telefone", plan: "Plano", lifetime: "Vitalício", adminBadge: "Plano Admin" },
  en: { name: "Full name", company: "Company", required: "required", companyPh: "Your company name", email: "Email", phone: "Phone", location: "Location", bio: "Bio", bioPh: "Tell us a bit about you...", save: "Save Changes", saved: "Profile updated!", err: "Error saving", cancel: "Cancel", leads: "Leads", withPhone: "With phone", plan: "Plan", lifetime: "Lifetime", adminBadge: "Admin Plan" },
  es: { name: "Nombre completo", company: "Empresa", required: "obligatorio", companyPh: "Nombre de tu empresa", email: "Email", phone: "Teléfono", location: "Ubicación", bio: "Biografía", bioPh: "Cuéntanos un poco sobre ti...", save: "Guardar Cambios", saved: "¡Perfil actualizado!", err: "Error al guardar", cancel: "Cancelar", leads: "Leads", withPhone: "Con teléfono", plan: "Plan", lifetime: "Vitalicio", adminBadge: "Plan Admin" },
};

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { lang } = useLang();
  const { profile, account, session, refresh } = useAuth();
  const D = DICT[lang];
  const [f, setF] = useState({ full_name: "", company_name: "", phone: "", location: "", bio: "" });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [stats, setStats] = useState<{ total: number; phonePct: number }>({ total: 0, phonePct: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const root = document.querySelector(".ml-root") as HTMLElement | null;

  const isAdmin = (profile?.account_role ?? "admin") === "admin";
  const planLabel = isAdmin ? D.lifetime : (account?.plan ?? "starter");
  const name = profile?.full_name || session?.user?.email?.split("@")[0] || "—";
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  useEffect(() => {
    setF({ full_name: profile?.full_name ?? "", company_name: (profile as { company_name?: string | null })?.company_name ?? "", phone: profile?.phone ?? "", location: profile?.location ?? "", bio: profile?.bio ?? "" });
    setAvatar(profile?.avatar_url ?? null);
  }, [profile]);

  const companyEmpty = !f.company_name.trim();

  useEffect(() => {
    if (!account?.id) return;
    (async () => {
      const total = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("account_id", account.id);
      const withPhone = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("account_id", account.id).not("phone", "is", null);
      const t = total.count ?? 0; const p = withPhone.count ?? 0;
      setStats({ total: t, phonePct: t ? Math.round((p / t) * 100) : 0 });
    })();
  }, [account?.id]);

  if (!root) return null;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function onFile(file: File) {
    if (!session?.user?.id) return;
    setUploading(true); setMsg(null);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${session.user.id}/avatar.${ext}`;
      const up = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (up.error) throw up.error;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", session.user.id);
      setAvatar(url);
      await refresh();
    } catch { setMsg({ ok: false, text: D.err }); }
    finally { setUploading(false); }
  }

  async function save() {
    if (!profile?.id || companyEmpty) return;
    setBusy(true); setMsg(null);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: f.full_name.trim() || null, company_name: f.company_name.trim(), phone: f.phone.trim() || null, location: f.location.trim() || null, bio: f.bio.trim() || null,
      }).eq("id", profile.id);
      if (error) throw error;
      await refresh();
      setMsg({ ok: true, text: D.saved });
    } catch { setMsg({ ok: false, text: D.err }); }
    finally { setBusy(false); }
  }

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,17,40,.5)", backdropFilter: "blur(3px)", zIndex: 900 }} />
      <aside className="ml-scroll" style={{ position: "fixed", top: 0, right: 0, height: "100vh", width: "min(420px,92vw)", background: "var(--ml-card)", borderLeft: "1px solid var(--ml-border)", zIndex: 901, boxShadow: "-18px 0 50px rgba(20,17,40,.16)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {/* header roxo */}
        <div style={{ position: "relative", height: 96, background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", flexShrink: 0 }}>
          <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,.12)" }} />
          <button onClick={onClose} style={{ position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 9, border: "none", background: "rgba(255,255,255,.2)", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}><Icon name="x" size={16} /></button>
        </div>

        <div style={{ padding: "0 22px 22px", flex: 1 }}>
          {/* avatar + camera */}
          <div style={{ marginTop: -34, position: "relative", width: 72, height: 72 }}>
            <div style={{ width: 72, height: 72, borderRadius: 18, border: "3px solid var(--ml-card)", overflow: "hidden", background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", color: "#fff", display: "grid", placeItems: "center", fontSize: 24, fontWeight: 800 }}>
              {avatar ? <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ position: "absolute", bottom: -2, right: -2, width: 26, height: 26, borderRadius: 8, border: "2px solid var(--ml-card)", background: "var(--ml-primary)", color: "#fff", cursor: uploading ? "default" : "pointer", display: "grid", placeItems: "center" }}>
              {uploading ? <Icon name="loader" size={12} className="ml-spin" /> : <Icon name="camera" size={13} />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 12 }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{name}</div>
            {isAdmin && <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "var(--ml-primary)", background: "rgba(76,46,224,.12)", padding: "4px 10px", borderRadius: 20 }}><Icon name="crown" size={13} />{D.adminBadge}</span>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
            <Field label={D.name} value={f.full_name} onChange={set("full_name")} />
            <div>
              <label style={lbl}>
                {D.company}<span style={{ color: "var(--ml-red)" }}> *</span>
                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: "var(--ml-red)", background: "rgba(239,68,68,.1)", padding: "2px 7px", borderRadius: 20, textTransform: "none", letterSpacing: 0 }}>{D.required}</span>
              </label>
              <input value={f.company_name} onChange={set("company_name")} placeholder={D.companyPh}
                style={{ ...inp, border: `1px solid ${companyEmpty ? "var(--ml-red)" : "var(--ml-border)"}` }} />
            </div>
            <div>
              <label style={lbl}>{D.email}</label>
              <input value={session?.user?.email ?? ""} disabled style={{ ...inp, opacity: 0.6, cursor: "not-allowed" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label={D.phone} value={f.phone} onChange={set("phone")} />
              <Field label={D.location} value={f.location} onChange={set("location")} />
            </div>
            <div>
              <label style={lbl}>{D.bio}</label>
              <textarea value={f.bio} onChange={set("bio")} rows={3} placeholder={D.bioPh} style={{ ...inp, resize: "vertical", fontFamily: "inherit" }} />
            </div>
          </div>

          {/* stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--ml-border)", textAlign: "center" }}>
            <Stat value={String(stats.total)} label={D.leads} />
            <Stat value={`${stats.phonePct}%`} label={D.withPhone} />
            <Stat value={planLabel} label={D.plan} color="var(--ml-green)" />
          </div>

          {msg && <div style={{ marginTop: 14, fontSize: 13, color: msg.ok ? "var(--ml-green)" : "var(--ml-red)", background: msg.ok ? "rgba(16,185,129,.12)" : "rgba(239,68,68,.1)", padding: "10px 12px", borderRadius: 10 }}>{msg.text}</div>}
        </div>

        {/* footer */}
        <div style={{ position: "sticky", bottom: 0, display: "flex", gap: 10, justifyContent: "flex-end", padding: 18, borderTop: "1px solid var(--ml-border)", background: "var(--ml-card)" }}>
          <button onClick={onClose} disabled={busy} style={{ padding: "11px 20px", borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-navtext)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>{D.cancel}</button>
          <button onClick={save} disabled={busy || companyEmpty} style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 22px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", color: "#fff", fontWeight: 700, fontSize: 14, cursor: busy || companyEmpty ? "not-allowed" : "pointer", opacity: busy || companyEmpty ? 0.6 : 1 }}>{busy ? <Icon name="loader" size={15} className="ml-spin" /> : <Icon name="check" size={15} />}{D.save}</button>
        </div>
      </aside>
    </>,
    root
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (e: { target: { value: string } }) => void }) {
  return (<div><label style={lbl}>{label}</label><input value={value} onChange={onChange} style={inp} /></div>);
}
function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (<div><div style={{ fontSize: 19, fontWeight: 800, color: color ?? "var(--ml-text)" }}>{value}</div><div style={{ fontSize: 11.5, color: "var(--ml-muted)", marginTop: 2 }}>{label}</div></div>);
}

const lbl: CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--ml-muted)", marginBottom: 6 };
const inp: CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", fontSize: 14, outline: "none" };
