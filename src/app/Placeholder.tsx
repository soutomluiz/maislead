import { useLang } from "./LangTheme";
import { Icon } from "./icons";

export function Placeholder() {
  const { t } = useLang();
  return (
    <div className="ml-fade" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 340, textAlign: "center", color: "var(--ml-muted)" }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: "var(--ml-grid)", display: "grid", placeItems: "center", color: "var(--ml-primary)", marginBottom: 16 }}>
        <Icon name="spark" size={30} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ml-text)" }}>{t.common.soon}</div>
      <div style={{ fontSize: 13.5, marginTop: 4, maxWidth: 340 }}>{t.common.soonSub}</div>
    </div>
  );
}
