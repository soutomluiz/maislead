import { type ReactNode } from "react";
import { CenterModal } from "../CenterModal";
import { Icon, type IconName } from "../icons";

// Detalhe de uma empresa AINDA NÃO importada (staging) — popup central com dados da Receita
// + botão "Adicionar à lista". Compartilhado por CNPJ e Recém-abertas.
export interface StagingCompany {
  cnpj: string; cnpjFmt: string; company: string;
  razao_social?: string | null; nome_fantasia?: string | null;
  cnae?: string | null; porte?: string | null; abertura?: string | null; capital?: string | null;
  uf?: string | null; municipio?: string | null; mei?: boolean;
  email?: string | null; phone?: string | null; address?: string | null;
}
export interface Badge { label: string; color: string; bg: string }

const DICT = {
  pt: { receita: "Dados da Receita", razao: "Razão social", fantasia: "Nome fantasia", porte: "Porte", cnae: "Atividade (CNAE)", abertura: "Abertura", capital: "Capital social", local: "Localização", add: "Adicionar à lista", added: "Já na lista", adding: "Adicionando…" },
  en: { receita: "Registry data", razao: "Legal name", fantasia: "Trade name", porte: "Size", cnae: "Activity (CNAE)", abertura: "Opened", capital: "Share capital", local: "Location", add: "Add to list", added: "In list", adding: "Adding…" },
  es: { receita: "Datos del registro", razao: "Razón social", fantasia: "Nombre comercial", porte: "Tamaño", cnae: "Actividad (CNAE)", abertura: "Apertura", capital: "Capital social", local: "Ubicación", add: "Añadir a la lista", added: "En la lista", adding: "Añadiendo…" },
};
const LOCALE: Record<string, string> = { pt: "pt-BR", en: "en-US", es: "es-ES" };

export function StagingDetailModal({ data, badges, added, importing, onAdd, onClose, lang }: {
  data: StagingCompany; badges: Badge[]; added: boolean; importing: boolean; onAdd: () => void; onClose: () => void; lang: "pt" | "en" | "es";
}) {
  const D = DICT[lang];
  const abertura = data.abertura ? (() => { try { return new Date(data.abertura + "T00:00:00").toLocaleDateString(LOCALE[lang]); } catch { return data.abertura; } })() : "—";
  const local = [data.municipio, data.uf].filter(Boolean).join(" / ") || "—";

  return (
    <CenterModal onClose={onClose} width={480}>
      <div style={{ padding: 22 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ml-muted)", textTransform: "uppercase", letterSpacing: 0.6 }}>{D.receita}</div>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.25, marginTop: 4 }}>{data.company}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: "var(--ml-muted)" }}>{data.cnpjFmt}</span>
              {badges.map((b, i) => <BadgeEl key={i} color={b.color} bg={b.bg}>{b.label}</BadgeEl>)}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 10, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="x" size={17} strokeWidth={2.2} /></button>
        </div>

        <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 16, padding: 18, marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 14px" }}>
          {data.razao_social && <Field label={D.razao} value={data.razao_social} span />}
          <Field label={D.fantasia} value={data.nome_fantasia || "—"} />
          <Field label={D.porte} value={data.porte || (data.mei ? "MEI" : "—")} />
          <Field label={D.cnae} value={data.cnae || "—"} span />
          <Field label={D.abertura} value={abertura} />
          <Field label={D.capital} value={data.capital || "—"} />
          <Field label={D.local} value={local} span />
        </div>

        <div style={{ background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 16, padding: "6px 16px", marginBottom: 18 }}>
          <Contact icon="phone" value={data.phone} />
          <Contact icon="mail" value={data.email} />
          <Contact icon="mapPin" value={data.address ?? local} />
        </div>

        <button onClick={onAdd} disabled={added || importing} style={{ width: "100%", height: 48, borderRadius: 13, border: "none", background: added ? "var(--ml-grid)" : "linear-gradient(135deg,#6d5cf5,#8b6bff)", color: added ? "var(--ml-muted)" : "#fff", fontWeight: 700, fontSize: 15, cursor: added || importing ? "default" : "pointer", opacity: importing && !added ? 0.7 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: added ? "none" : "0 8px 18px rgba(109,92,245,.28)" }}>
          {added ? <><Icon name="check" size={16} />{D.added}</> : importing ? <><Icon name="loader" size={16} className="ml-spin" />{D.adding}</> : <><Icon name="plus" size={16} strokeWidth={2.4} />{D.add}</>}
        </button>
      </div>
    </CenterModal>
  );
}

function Field({ label, value, span }: { label: string; value: string; span?: boolean }) {
  return (
    <div style={{ gridColumn: span ? "1 / -1" : undefined, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ml-muted)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: "var(--ml-text)", fontWeight: 600, lineHeight: 1.4 }}>{value}</div>
    </div>
  );
}
function Contact({ icon, value }: { icon: IconName; value: string | null | undefined }) {
  const present = !!(value && value.trim() && value.trim() !== "—");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 2px", fontSize: 13.5 }}>
      <span style={{ color: present ? "var(--ml-primary)" : "var(--ml-muted)", flexShrink: 0 }}><Icon name={icon} size={16} /></span>
      <span style={{ color: present ? "var(--ml-text)" : "var(--ml-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>{present ? value : "—"}</span>
    </div>
  );
}
function BadgeEl({ children, color, bg }: { children: ReactNode; color: string; bg: string }) {
  return <span style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, color, background: bg, padding: "2px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>{children}</span>;
}
