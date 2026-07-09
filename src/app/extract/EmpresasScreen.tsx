import { useState } from "react";
import { useLang } from "../LangTheme";
import { Icon, type IconName } from "../icons";
import { CnpjScreen } from "./CnpjScreen";
import { RecemAbertasScreen } from "./RecemAbertasScreen";
import { LookalikeScreen } from "./LookalikeScreen";
import type { ScreenKey } from "@/i18n/ml";

// Módulo "Empresas (Receita)" — agrupa as ferramentas baseadas na Receita:
//  - Por CNPJ: cola CNPJs e consulta.
//  - Recém-abertas: filtra empresas que abriram recentemente.
//  - Espelhar clientes: acha empresas parecidas com os melhores clientes.
type Tab = "cnpj" | "recem" | "lookalike";
const TABS: Record<"pt" | "en" | "es", Record<Tab, string>> = {
  pt: { cnpj: "Por CNPJ", recem: "Recém-abertas", lookalike: "Espelhar clientes" },
  en: { cnpj: "By CNPJ", recem: "Newly Opened", lookalike: "Mirror clients" },
  es: { cnpj: "Por CNPJ", recem: "Recién Abiertas", lookalike: "Espejar clientes" },
};
const TAB_ICON: Record<Tab, IconName> = { cnpj: "building", recem: "spark", lookalike: "users" };

export function EmpresasScreen({ onNavigate }: { onNavigate?: (s: ScreenKey) => void }) {
  const { lang } = useLang();
  const T = TABS[lang];
  const [tab, setTab] = useState<Tab>("cnpj");

  return (
    <div className="ml-fade" style={{ maxWidth: 920, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 6, padding: 5, borderRadius: 14, background: "var(--ml-grid)", border: "1px solid var(--ml-border)", width: "fit-content", margin: "0 auto 20px", flexWrap: "wrap" }}>
        {(["cnpj", "recem", "lookalike"] as const).map((k) => {
          const on = tab === k;
          return (
            <button key={k} onClick={() => setTab(k)} style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 700, background: on ? "var(--ml-card)" : "transparent", color: on ? "var(--ml-primary)" : "var(--ml-muted)", boxShadow: on ? "0 2px 8px rgba(20,17,40,.08)" : "none", transition: ".15s" }}>
              <Icon name={TAB_ICON[k]} size={15} />{T[k]}
            </button>
          );
        })}
      </div>

      {tab === "cnpj" ? <CnpjScreen onNavigate={onNavigate} />
        : tab === "recem" ? <RecemAbertasScreen onNavigate={onNavigate} />
        : <LookalikeScreen onNavigate={onNavigate} />}
    </div>
  );
}
