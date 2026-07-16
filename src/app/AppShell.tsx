import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Placeholder } from "./Placeholder";
import { DashboardScreen } from "./DashboardScreen";
import { LeadsScreen } from "./leads/LeadsScreen";
import { ManualScreen } from "./ManualScreen";
import { ScoreScreen } from "./ScoreScreen";
import { TimelineScreen } from "./TimelineScreen";
import { ReportsScreen } from "./ReportsScreen";
import { SettingsScreen } from "./SettingsScreen";
import { ExtractionScreen } from "./extract/ExtractionScreen";
import { EmpresasScreen } from "./extract/EmpresasScreen";
import { CrmScreen } from "./crm/CrmScreen";
import { AgendaScreen } from "./crm/AgendaScreen";
import { SubScreen } from "./SubScreen";
import { IntegrationsScreen } from "./IntegrationsScreen";
import type { ScreenKey } from "@/i18n/ml";

export function AppShell() {
  // Deep-link da landing: ?plan=pro|business abre direto na tela de Assinatura.
  const [screen, setScreen] = useState<ScreenKey>(() => {
    try { return new URLSearchParams(window.location.search).get("plan") ? "sub" : "dashboard"; } catch { return "dashboard"; }
  });

  return (
    <div style={{ position: "relative", display: "flex", height: "100vh", width: "100%", overflow: "hidden", background: "var(--ml-bg)", color: "var(--ml-text)" }}>
      <Sidebar active={screen} onNavigate={setScreen} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
        <Topbar screen={screen} />
        <main className="ml-scroll" style={{ flex: 1, overflowY: "auto", padding: "28px 32px 48px" }}>
          {screen === "dashboard" ? <DashboardScreen />
            : screen === "leadslist" ? <LeadsScreen />
            : screen === "manual" ? <ManualScreen />
            : screen === "gplaces" ? <ExtractionScreen source="google_maps" fn="extract-google-maps" onGoLeads={() => setScreen("leadslist")} />
            : screen === "cnpj" ? <EmpresasScreen onNavigate={setScreen} />
            : screen === "crm" ? <CrmScreen onNavigate={setScreen} />
            : screen === "agenda" ? <AgendaScreen />
            : screen === "score" ? <ScoreScreen />
            : screen === "timeline" ? <TimelineScreen />
            : screen === "reports" ? <ReportsScreen />
            : screen === "integrations" ? <IntegrationsScreen />
            : screen === "sub" ? <SubScreen />
            : screen === "settings" ? <SettingsScreen onNavigate={setScreen} />
            : <Placeholder />}
        </main>
      </div>
    </div>
  );
}
