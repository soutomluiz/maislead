import "./app/theme.css";
import { ThemeProvider, LanguageProvider } from "./app/LangTheme";
import { AuthProvider } from "./app/AuthContext";
import { MaisLeadApp } from "./app/MaisLeadApp";

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <MaisLeadApp />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
