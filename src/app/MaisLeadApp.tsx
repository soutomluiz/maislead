import { useAuth } from "./AuthContext";
import { useTheme } from "./LangTheme";
import { AuthScreen } from "./AuthScreen";
import { AppShell } from "./AppShell";
import { Icon } from "./icons";

export function MaisLeadApp() {
  const { dark } = useTheme();
  const { loading, session } = useAuth();

  return (
    <div className={`ml-root${dark ? " dark" : ""}`}>
      {loading ? (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
          <Icon name="loader" size={30} className="ml-spin" style={{ color: "var(--ml-primary)" }} />
        </div>
      ) : session ? (
        <AppShell />
      ) : (
        <AuthScreen />
      )}
    </div>
  );
}
