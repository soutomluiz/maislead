import { useState, CSSProperties } from "react";
import { useLang, useTheme } from "./LangTheme";
import { useAuth } from "./AuthContext";
import { Icon } from "./icons";
import { ProfileModal } from "./ProfileModal";
import type { Lang, ScreenKey } from "@/i18n/ml";

export function Topbar({ screen }: { screen: ScreenKey }) {
  const { t, lang, setLang } = useLang();
  const { dark, toggle } = useTheme();
  const { profile, session, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  const titleArr = t.titles[screen] ?? t.titles.dashboard;
  const name = profile?.full_name || session?.user?.email?.split("@")[0] || "—";
  const role = profile?.account_role ?? "admin";
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const iconBtn: CSSProperties = { width: 40, height: 40, borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

  const langBtn = (l: Lang, mid: boolean): CSSProperties => ({
    width: 42, border: "none", background: lang === l ? "rgba(109,92,245,.1)" : "transparent",
    borderLeft: mid ? "1px solid var(--ml-border)" : undefined, borderRight: mid ? "1px solid var(--ml-border)" : undefined,
    fontSize: 12, fontWeight: 700, cursor: "pointer", color: lang === l ? "#6d5cf5" : "var(--ml-muted)",
  });

  return (
    <header style={{ height: 72, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px", borderBottom: "1px solid var(--ml-border)", background: "var(--ml-sidebar)" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-.02em" }}>{titleArr[0]}</h1>
        <div style={{ fontSize: 12.5, color: "var(--ml-muted)", marginTop: 2 }}>{titleArr[1]}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {/* Idioma — segmentado */}
        <div style={{ display: "flex", border: "1px solid var(--ml-border)", borderRadius: 11, overflow: "hidden", height: 40 }}>
          <button style={langBtn("pt", false)} onClick={() => setLang("pt")}>PT</button>
          <button style={langBtn("en", true)} onClick={() => setLang("en")}>EN</button>
          <button style={langBtn("es", false)} onClick={() => setLang("es")}>ES</button>
        </div>

        {/* Tema */}
        <button style={iconBtn} onClick={toggle} title={t.common.theme}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#6d5cf5"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ml-muted)"; }}>
          <Icon name={dark ? "sun" : "moon"} size={18} />
        </button>

        {/* Perfil */}
        <button onClick={() => setProfileOpen(true)} title={t.common.profile}
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "4px 10px 4px 4px", borderRadius: 30, border: "none", background: "transparent", transition: ".15s" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--ml-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
          <span style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#6d5cf5,#9d7bff)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{initials}</span>
          <span style={{ textAlign: "left", lineHeight: 1.2 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ml-text)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
            <span style={{ display: "block", fontSize: 11, color: "var(--ml-muted)" }}>{roleLabel}</span>
          </span>
        </button>

        {/* Logout */}
        <button onClick={() => signOut()} title={t.common.logout} style={iconBtn}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.borderColor = "#fecaca"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--ml-muted)"; e.currentTarget.style.borderColor = "var(--ml-border)"; }}>
          <Icon name="logout" size={18} />
        </button>
      </div>
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </header>
  );
}
