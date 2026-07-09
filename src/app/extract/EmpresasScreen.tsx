import { useState } from "react";
import { useLang } from "../LangTheme";
import { Icon } from "../icons";
import { CnpjScreen } from "./CnpjScreen";
import { RecemAbertasScreen } from "./RecemAbertasScreen";
import type { ScreenKey } from "@/i18n/ml";

// Módulo "Empresas (Receita)" — agrupa as duas ferramentas baseadas na Receita:
//  - Por CNPJ: cola CNPJs e consulta.
//  - Recém-abertas: filtra empresas que abriram recentemente.
const TABS = {
  pt: { cnpj: "Por CNPJ", recem: "Recém-abertas" },
  en: { cnpj: "By CNPJ", recem: "Newly Opened" },
  es: { cnpj: "Por CNPJ", recem: "Recién Abiertas" },
};

export function EmpresasScreen({ onNavigate }: { onNavigate?: (s: ScreenKey) => void }) {
  const { lang } = useLang();
  const T = TABS[lang];
  const [tab, setTab] = useState<"cnpj" | "recem">("cnpj");

  return (
    <div className="ml-fade" style={{ maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 6, padding: 5, borderRadius: 14, background: "var(--ml-grid)", border: "1px solid var(--ml-border)", width: "fit-content", margin: "0 auto 20px" }}>
        {(["cnpj", "recem"] as const).map((k) => {
          const on = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700, background: on ? "var(--ml-card)" : "transparent", color: on ? "var(--ml-primary)" : "var(--ml-muted)", boxShadow: on ? "0 2px 8px rgba(20,17,40,.08)" : "none", transition: ".15s" }}>
              <Icon name={k === "cnpj" ? "building" : "spark"} size={15} />{T[k]}
            </button>
          );
        })}
      </div>

      {tab === "cnpj" ? <CnpjScreen onNavigate={onNavigate} /> : <RecemAbertasScreen onNavigate={onNavigate} />}
    </div>
  );
}
