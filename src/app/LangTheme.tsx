import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { DICT, Lang } from "@/i18n/ml";

/* ---------------- Language ---------------- */
interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (typeof DICT)[Lang];
}
const LanguageContext = createContext<LangCtx | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = (typeof localStorage !== "undefined" && localStorage.getItem("ml_lang")) as Lang | null;
    return saved && DICT[saved] ? saved : "pt";
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("ml_lang", l); } catch { /* ignore */ }
  };
  return (
    <LanguageContext.Provider value={{ lang, setLang, t: DICT[lang] }}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}

/* ---------------- Theme ---------------- */
interface ThemeCtx {
  dark: boolean;
  setDark: (v: boolean) => void;
  toggle: () => void;
}
const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDarkState] = useState<boolean>(() => {
    try { return localStorage.getItem("ml_theme") === "dark"; } catch { return false; }
  });
  const setDark = (v: boolean) => {
    setDarkState(v);
    try { localStorage.setItem("ml_theme", v ? "dark" : "light"); } catch { /* ignore */ }
  };
  useEffect(() => {
    // aplica no <html> pra cobrir portais/overlays também
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark]);
  return (
    <ThemeContext.Provider value={{ dark, setDark, toggle: () => setDark(!dark) }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
