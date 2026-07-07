import { useState, type CSSProperties } from "react";
import { useLang, useTheme } from "./LangTheme";
import { Icon, type IconName } from "./icons";
import { getPerPage, setPerPage, getExportFormat, setExportFormat, type ExportFormat } from "./prefs";
import type { Lang, ScreenKey } from "@/i18n/ml";

const DICT = {
  pt: { prefs: "Preferências", exportFmt: "Formato de exportação", perPage: "Itens por página", theme: "Tema", light: "Claro", dark: "Escuro", language: "Idioma", apply: "Aplicar Configurações", saved: "Configurações aplicadas!", integrations: "Integrações", integrationsSub: "Conecte o maisLEAD ao seu CRM e envie leads automaticamente.", manage: "Gerenciar" },
  en: { prefs: "Preferences", exportFmt: "Export format", perPage: "Items per page", theme: "Theme", light: "Light", dark: "Dark", language: "Language", apply: "Apply Settings", saved: "Settings applied!", integrations: "Integrations", integrationsSub: "Connect maisLEAD to your CRM and send leads automatically.", manage: "Manage" },
  es: { prefs: "Preferencias", exportFmt: "Formato de exportación", perPage: "Elementos por página", theme: "Tema", light: "Claro", dark: "Oscuro", language: "Idioma", apply: "Aplicar Configuración", saved: "¡Configuración aplicada!", integrations: "Integraciones", integrationsSub: "Conecta maisLEAD a tu CRM y envía leads automáticamente.", manage: "Gestionar" },
};

export function SettingsScreen({ onNavigate }: { onNavigate?: (s: ScreenKey) => void }) {
  const { lang, setLang } = useLang();
  const { dark, setDark } = useTheme();
  const D = DICT[lang];
  const [perPage, setPP] = useState(getPerPage());
  const [fmt, setFmt] = useState<ExportFormat>(getExportFormat());
  const [saved, setSaved] = useState(false);

  function apply() {
    setPerPage(perPage);
    setExportFormat(fmt);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="ml-fade" style={{ maxWidth: 820, margin: "8px auto 0", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>{D.prefs}</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div>
            <label style={lbl}>{D.exportFmt}</label>
            <select value={fmt} onChange={(e) => setFmt(e.target.value as ExportFormat)} style={select}>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div>
            <label style={lbl}>{D.perPage}</label>
            <select value={perPage} onChange={(e) => setPP(Number(e.target.value))} style={select}>
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div>
            <label style={lbl}>{D.theme}</label>
            <Toggle options={[[false, D.light, "sun"], [true, D.dark, "moon"]]} value={dark} onChange={(v) => setDark(v as boolean)} />
          </div>
          <div>
            <label style={lbl}>{D.language}</label>
            <Toggle options={([["pt", "Português"], ["en", "English"], ["es", "Español"]] as [Lang, string][])} value={lang} onChange={(v) => setLang(v as Lang)} />
          </div>
        </div>

        <button onClick={apply} style={{ width: "100%", height: 48, marginTop: 22, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, border: "none", background: "linear-gradient(135deg,#6d5cf5,#8b6bff)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 10px 24px rgba(109,92,245,.3)" }}>
          {saved ? <Icon name="check" size={17} /> : null}{saved ? D.saved : D.apply}
        </button>
      </div>

      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{D.integrations}</div>
          <div style={{ fontSize: 13, color: "var(--ml-muted)", marginTop: 3 }}>{D.integrationsSub}</div>
        </div>
        <button onClick={() => onNavigate?.("integrations")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", borderRadius: 10, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-primary)", fontWeight: 600, fontSize: 13.5, cursor: "pointer", whiteSpace: "nowrap" }}>
          {D.manage} <Icon name="chevron" size={15} style={{ transform: "rotate(-90deg)" }} />
        </button>
      </div>
    </div>
  );
}

function Toggle<T extends string | boolean>({ options, value, onChange }: { options: (readonly [T, string] | readonly [T, string, string])[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {options.map((o) => {
        const v = o[0]; const lblTxt = o[1]; const icon = o[2] as IconName | undefined;
        const on = value === v;
        return (
          <button key={String(v)} onClick={() => onChange(v)} style={{ flex: 1, height: 46, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, border: `1px solid ${on ? "var(--ml-primary)" : "var(--ml-border)"}`, background: on ? "rgba(109,92,245,.1)" : "var(--ml-card)", color: on ? "var(--ml-primary)" : "var(--ml-navtext)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {icon && <Icon name={icon} size={14} />}{lblTxt}
          </button>
        );
      })}
    </div>
  );
}

const card: CSSProperties = { background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 20, padding: 26, boxShadow: "0 1px 3px rgba(30,25,60,.04)" };
const lbl: CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--ml-text)", marginBottom: 7 };
const select: CSSProperties = { width: "100%", height: 46, padding: "0 14px", borderRadius: 12, border: "1px solid var(--ml-border)", background: "var(--ml-input)", color: "var(--ml-text)", fontSize: 14, outline: "none", cursor: "pointer" };
