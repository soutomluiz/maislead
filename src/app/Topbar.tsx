import { useState, CSSProperties } from "react";
import { useLang } from "./LangTheme";
import { useTheme } from "./LangTheme";
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
  const role = (profile?.account_role ?? "admin");
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const langBtn = (l: Lang): CSSProperties => ({
    padding: "4px 8px", borderRadius: 8, border: "1px solid var(--ml-border)", cursor: "pointer", fontSize: 12, fontWeight: 600,
    background: lang === l ? "rgba(109,92,245,.12)" : "var(--ml-card)",
    color: lang === l ? "var(--ml-primary)" : "var(--ml-text)",
  });
  const iconBtn: CSSProperties = { width: 38, height: 38, borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-text)", cursor: "pointer", display: "grid", placeItems: "center" };

  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
      <div>
        <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: -0.5, margin: 0 }}>{titleArr[0]}</h1>
        <div style={{ fontSize: 13.5, color: "var(--ml-muted)", marginTop: 2 }}>{titleArr[1]}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {(["pt", "en", "es"] as Lang[]).map((l) => (
            <button key={l} style={langBtn(l)} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
          ))}
        </div>
        <button style={iconBtn} onClick={toggle} title={t.common.theme}>
          <Icon name={dark ? "sun" : "moon"} size={17} />
        </button>

        <button onClick={() => setProfileOpen(true)} title={t.common.profile} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 12px 5px 5px", borderRadius: 12, border: "1px solid var(--ml-border)", background: "var(--ml-card)", cursor: "pointer" }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", color: "#fff", display: "grid", placeItems: "center", fontSize: 12.5, fontWeight: 700 }}>{initials}</span>
          <span style={{ textAlign: "left", lineHeight: 1.15 }}>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--ml-text)", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
            <span style={{ display: "block", fontSize: 11.5, color: "var(--ml-muted)" }}>{roleLabel}</span>
          </span>
        </button>
        <button onClick={() => signOut()} title={t.common.logout} style={iconBtn}>
          <Icon name="logout" size={17} />
        </button>
      </div>
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </header>
  );
}
