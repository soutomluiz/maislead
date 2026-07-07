import { useLang } from "./LangTheme";
import { Icon } from "./icons";

const DICT = {
  pt: {
    badge: "Plano Admin", title: "Assinatura Vitalícia Ativa", sub: "Acesso vitalício a todas as funcionalidades da plataforma maisLEAD.", active: "Ativo",
    included: "Recursos Inclusos", history: "Histórico de Pagamentos", historyNote: "Você possui uma assinatura vitalícia como administrador.", noCharge: "Nenhuma cobrança recorrente",
    feats: ["Extração ilimitada de leads", "Integração com CRMs via webhook", "Relatórios e pontuação de leads", "Suporte prioritário"],
  },
  en: {
    badge: "Admin Plan", title: "Lifetime Subscription Active", sub: "Lifetime access to all maisLEAD platform features.", active: "Active",
    included: "Included Features", history: "Payment History", historyNote: "You have a lifetime subscription as an administrator.", noCharge: "No recurring charges",
    feats: ["Unlimited lead extraction", "CRM integration via webhook", "Reports and lead scoring", "Priority support"],
  },
  es: {
    badge: "Plan Admin", title: "Suscripción Vitalicia Activa", sub: "Acceso vitalicio a todas las funciones de la plataforma maisLEAD.", active: "Activo",
    included: "Recursos Incluidos", history: "Historial de Pagos", historyNote: "Tienes una suscripción vitalicia como administrador.", noCharge: "Sin cargos recurrentes",
    feats: ["Extracción ilimitada de leads", "Integración con CRMs vía webhook", "Informes y puntuación de leads", "Soporte prioritario"],
  },
};

export function SubScreen() {
  const { lang } = useLang();
  const D = DICT[lang];

  return (
    <div className="ml-fade" style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* card vitalício */}
      <div style={{ position: "relative", overflow: "hidden", background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", borderRadius: 20, padding: 26, color: "#fff" }}>
        <div style={{ position: "absolute", top: -40, right: -20, width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,.10)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", opacity: 0.9 }}><Icon name="crown" size={15} />{D.badge}</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 10 }}>{D.title}</div>
          <div style={{ fontSize: 14.5, opacity: 0.92, marginTop: 6, maxWidth: 460 }}>{D.sub}</div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 16, fontSize: 12.5, fontWeight: 700, background: "rgba(16,185,129,.25)", color: "#fff", padding: "6px 13px", borderRadius: 20 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399" }} />{D.active}
          </span>
        </div>
      </div>

      {/* incluídos + histórico */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{D.included}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {D.feats.map((f) => (
              <div key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                <span style={{ color: "var(--ml-green)", display: "grid", placeItems: "center", flexShrink: 0 }}><Icon name="check" size={16} /></span>
                {f}
              </div>
            ))}
          </div>
        </div>

        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{D.history}</div>
          <div style={{ fontSize: 13, color: "var(--ml-muted)", marginBottom: 16, lineHeight: 1.5 }}>{D.historyNote}</div>
          <div style={{ display: "grid", placeItems: "center", minHeight: 90, border: "1px dashed var(--ml-border)", borderRadius: 12, color: "var(--ml-muted)", fontSize: 13.5 }}>{D.noCharge}</div>
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = { background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 18, padding: 22 };
