import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Modal central reutilizável (popup no meio da tela, com backdrop e scroll interno).
// Fecha no clique do fundo e no Esc. Usado por LeadModal, StagingDetailModal, etc.
export function CenterModal({ onClose, children, width = 560 }: { onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const target = (typeof document !== "undefined" && document.querySelector(".ml-root")) as HTMLElement | null;
  const node = (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,17,40,.55)", backdropFilter: "blur(3px)", display: "grid", placeItems: "center", zIndex: 1000, padding: 24 }}>
      <div
        className="ml-scroll"
        onClick={(e) => e.stopPropagation()}
        style={{ width, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", background: "var(--ml-bg)", border: "1px solid var(--ml-border)", borderRadius: 22, boxShadow: "0 30px 80px rgba(20,17,40,.4)", animation: "mlModalIn .26s cubic-bezier(.2,.7,.2,1)" }}
      >
        {children}
      </div>
    </div>
  );
  return target ? createPortal(node, target) : node;
}
