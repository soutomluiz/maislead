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
import { SubScreen } from "./SubScreen";
import { IntegrationsScreen } from "./IntegrationsScreen";
import type { ScreenKey } from "@/i18n/ml";

export function AppShell() {
  const [screen, setScreen] = useState<ScreenKey>("dashboard");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--ml-bg)" }}>
      <Sidebar active={screen} onNavigate={setScreen} />
      <main className="ml-scroll" style={{ flex: 1, padding: "24px 28px", overflowY: "auto", maxHeight: "100vh" }}>
        <Topbar screen={screen} />
        {screen === "dashboard" ? <DashboardScreen />
          : screen === "leadslist" ? <LeadsScreen />
          : screen === "manual" ? <ManualScreen />
          : screen === "gplaces" ? <ExtractionScreen source="google_maps" fn="extract-google-maps" onGoLeads={() => setScreen("leadslist")} />
          : screen === "websites" ? <ExtractionScreen source="website" fn="extract-website" onGoLeads={() => setScreen("leadslist")} />
          : screen === "score" ? <ScoreScreen />
          : screen === "timeline" ? <TimelineScreen />
          : screen === "reports" ? <ReportsScreen />
          : screen === "integrations" ? <IntegrationsScreen />
          : screen === "sub" ? <SubScreen />
          : screen === "settings" ? <SettingsScreen onNavigate={setScreen} />
          : <Placeholder />}
      </main>
    </div>
  );
}
