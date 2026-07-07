import { useState, type CSSProperties, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "./LangTheme";
import { useAuth } from "./AuthContext";
import { Icon } from "./icons";
import { scoreOf } from "@/lib/score";

const DICT = {
  pt: { title: "Novo Lead", subtitle: "Preencha os dados do lead manualmente", company: "Nome da empresa", contact: "Contato", industry: "Indústria", location: "Localização", phone: "Telefone", email: "E-mail", website: "Website", address: "Endereço", niche: "Relevância do nicho (0–10)", save: "Cadastrar lead", saved: "Lead cadastrado com sucesso!", required: "Informe o nome da empresa", err: "Erro ao cadastrar o lead" },
  en: { title: "New Lead", subtitle: "Fill in the lead data manually", company: "Company name", contact: "Contact", industry: "Industry", location: "Location", phone: "Phone", email: "Email", website: "Website", address: "Address", niche: "Niche relevance (0–10)", save: "Add lead", saved: "Lead added successfully!", required: "Enter the company name", err: "Error adding the lead" },
  es: { title: "Nuevo Lead", subtitle: "Completa los datos del lead manualmente", company: "Nombre de empresa", contact: "Contacto", industry: "Industria", location: "Ubicación", phone: "Teléfono", email: "Email", website: "Sitio web", address: "Dirección", niche: "Relevancia del nicho (0–10)", save: "Añadir lead", saved: "¡Lead añadido con éxito!", required: "Ingresa el nombre de la empresa", err: "Error al añadir el lead" },
};

export function ManualScreen() {
  const { lang } = useLang();
  const { account, session } = useAuth();
  const D = DICT[lang];
  const [f, setF] = useState({ company: "", contact: "", industry: "", location: "", phone: "", email: "", website: "", address: "" });
  const niche = 5; // relevância padrão (campo não exposto na UI, conforme protótipo)
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!f.company.trim()) { setMsg({ ok: false, text: D.required }); return; }
    setBusy(true);
    try {
      const score = scoreOf({ phone: f.phone, address: f.address, email: f.email, website: f.website, nicheQuality: niche });
      const { data, error } = await supabase.from("leads").insert({
        company_name: f.company.trim(),
        contact_name: f.contact.trim() || null,
        industry: f.industry.trim() || null,
        location: f.location.trim() || null,
        phone: f.phone.trim() || null,
        email: f.email.trim() || null,
        website: f.website.trim() || null,
        address: f.address.trim() || null,
        account_id: account?.id ?? null,
        user_id: session?.user?.id as string,
        source: "manual",
        type: "manual",
        status: "new",
        niche_quality: niche,
        score,
      }).select("id").single();
      if (error) throw error;
      if (data && account?.id) {
        await supabase.from("lead_events").insert({ lead_id: data.id, account_id: account.id, type: "created", payload: { source: "manual" } });
      }
      setMsg({ ok: true, text: D.saved });
      setF({ company: "", contact: "", industry: "", location: "", phone: "", email: "", website: "", address: "" });
    } catch {
      setMsg({ ok: false, text: D.err });
    } finally { setBusy(false); }
  }

  return (
    <div className="ml-fade" style={{ maxWidth: 640, margin: "8px auto 0" }}>
      <form onSubmit={submit} style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 22, padding: 32, boxShadow: "0 1px 3px rgba(30,25,60,.04)" }}>
        <div style={{ fontSize: 19, fontWeight: 800 }}>{D.title}</div>
        <div style={{ fontSize: 13, color: "var(--ml-muted)", marginTop: 3, marginBottom: 24 }}>{D.subtitle}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <Field label={D.company} value={f.company} onChange={set("company")} required full />
          <Field label={D.contact} value={f.contact} onChange={set("contact")} />
          <Field label={D.industry} value={f.industry} onChange={set("industry")} />
          <Field label={D.location} value={f.location} onChange={set("location")} />
          <Field label={D.phone} value={f.phone} onChange={set("phone")} />
          <Field label={D.email} value={f.email} onChange={set("email")} type="email" />
          <Field label={D.website} value={f.website} onChange={set("website")} />
          <Field label={D.address} value={f.address} onChange={set("address")} full />
        </div>

        {msg && <div style={{ marginTop: 14, fontSize: 13.5, color: msg.ok ? "var(--ml-green)" : "var(--ml-red)", background: msg.ok ? "rgba(16,185,129,.12)" : "rgba(239,68,68,.1)", padding: "10px 12px", borderRadius: 10 }}>{msg.text}</div>}

        <button type="submit" disabled={busy} style={{ width: "100%", height: 50, marginTop: 26, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, borderRadius: 13, border: "none", background: "linear-gradient(135deg,#6d5cf5,#8b6bff)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1, boxShadow: "0 10px 24px rgba(109,92,245,.32)" }}>
          {busy ? <Icon name="loader" size={18} className="ml-spin" /> : <Icon name="plus" size={18} strokeWidth={2.2} />}
          {D.save}
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, full }: { label: string; value: string; onChange: (e: { target: { value: string } }) => void; type?: string; required?: boolean; full?: boolean }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : undefined }}>
      <label style={labelStyle}>{label}{required && <span style={{ color: "var(--ml-red)" }}> *</span>}</label>
      <input type={type} value={value} onChange={onChange} style={inputStyle} />
    </div>
  );
}

const labelStyle: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--ml-text)", marginBottom: 7 };
const inputStyle: CSSProperties = { width: "100%", height: 46, padding: "0 14px", borderRadius: 12, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", fontSize: 14, outline: "none" };
