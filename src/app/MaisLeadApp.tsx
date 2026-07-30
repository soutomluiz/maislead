import { useAuth } from "./AuthContext";
import { useTheme } from "./LangTheme";
import { AuthScreen } from "./AuthScreen";
import { SetPasswordScreen } from "./SetPasswordScreen";
import { AppShell } from "./AppShell";
import { SignupCheckoutScreen } from "./SignupCheckoutScreen";
import { Icon } from "./icons";

export function MaisLeadApp() {
  const { dark } = useTheme();
  const { loading, session, recovery } = useAuth();

  // Visitante sem sessão vindo da landing com ?plan= → tela de cadastro/checkout.
  // (?mode=login força o login normal, usado pelo link "Já tem conta? Entrar".)
  const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const wantsSignup = !!q.get("plan") && q.get("mode") !== "login";

  return (
    <div className={`ml-root${dark ? " dark" : ""}`}>
      {loading ? (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
          <Icon name="loader" size={30} className="ml-spin" style={{ color: "var(--ml-primary)" }} />
        </div>
      ) : recovery ? (
        // Chegou por link de recovery → cria/redefine a senha ANTES de entrar no painel.
        // Precede `session` de propósito: o link já autentica, mas não pode pular a senha.
        <SetPasswordScreen />
      ) : session ? (
        <AppShell />
      ) : wantsSignup ? (
        <SignupCheckoutScreen />
      ) : (
        <AuthScreen />
      )}
    </div>
  );
}
