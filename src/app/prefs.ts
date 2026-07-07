// Preferências locais simples (persistidas em localStorage).
const PER_PAGE_OPTS = [10, 20, 50, 100];

export function getPerPage(): number {
  try { const v = parseInt(localStorage.getItem("ml_perpage") || "20", 10); return PER_PAGE_OPTS.includes(v) ? v : 20; }
  catch { return 20; }
}
export function setPerPage(v: number) {
  try { localStorage.setItem("ml_perpage", String(v)); } catch { /* ignore */ }
}

export type ExportFormat = "csv" | "json";
export function getExportFormat(): ExportFormat {
  try { return localStorage.getItem("ml_export") === "json" ? "json" : "csv"; }
  catch { return "csv"; }
}
export function setExportFormat(v: ExportFormat) {
  try { localStorage.setItem("ml_export", v); } catch { /* ignore */ }
}
