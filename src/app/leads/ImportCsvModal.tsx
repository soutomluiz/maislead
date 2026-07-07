import { useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { useLang } from "../LangTheme";
import { Icon } from "../icons";
import { scoreOf } from "@/lib/score";

const DICT = {
  pt: {
    title: "Importar leads (CSV)", pick: "Escolher arquivo CSV", model: "Baixar modelo",
    cols: "Colunas aceitas: empresa, telefone, email, website, cidade, setor, endereço.",
    importing: "Importando…", doImport: "Importar", cancel: "Cancelar", close: "Fechar",
    okTitle: "Importação concluída", imported: "importados", dup: "duplicados", err: "linhas com erro",
    noFile: "Selecione um arquivo CSV.", noRows: "Nenhuma linha válida encontrada.", failed: "Falha ao importar.",
    selected: "Selecionado",
  },
  en: {
    title: "Import leads (CSV)", pick: "Choose CSV file", model: "Download template",
    cols: "Accepted columns: company, phone, email, website, city, industry, address.",
    importing: "Importing…", doImport: "Import", cancel: "Cancel", close: "Close",
    okTitle: "Import complete", imported: "imported", dup: "duplicates", err: "error rows",
    noFile: "Select a CSV file.", noRows: "No valid rows found.", failed: "Import failed.",
    selected: "Selected",
  },
  es: {
    title: "Importar leads (CSV)", pick: "Elegir archivo CSV", model: "Descargar plantilla",
    cols: "Columnas aceptadas: empresa, teléfono, email, website, ciudad, sector, dirección.",
    importing: "Importando…", doImport: "Importar", cancel: "Cancelar", close: "Cerrar",
    okTitle: "Importación completa", imported: "importados", dup: "duplicados", err: "filas con error",
    noFile: "Selecciona un archivo CSV.", noRows: "No se encontraron filas válidas.", failed: "Fallo al importar.",
    selected: "Seleccionado",
  },
};

const FIELD_ALIASES: Record<string, string[]> = {
  company: ["empresa", "company", "nome", "name", "razao social", "razão social"],
  phone: ["telefone", "phone", "fone", "celular", "whatsapp"],
  email: ["email", "e-mail", "correo"],
  website: ["website", "site", "url", "web"],
  location: ["cidade", "city", "localizacao", "localização", "location", "ciudad"],
  industry: ["setor", "segmento", "industria", "indústria", "industry", "sector"],
  address: ["endereco", "endereço", "address", "direccion", "dirección"],
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === "," || c === ";") { cur.push(field); field = ""; }
      else if (c === "\n" || c === "\r") { if (field !== "" || cur.length) { cur.push(field); rows.push(cur); cur = []; field = ""; } if (c === "\r" && text[i + 1] === "\n") i++; }
      else field += c;
    }
  }
  if (field !== "" || cur.length) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

const norm = (s: string) => s.trim().toLowerCase();
const normPhone = (p?: string) => (p ? p.replace(/\D/g, "").replace(/^0+/, "") : "");
const normSite = (w?: string) => { if (!w) return ""; try { return new URL(w.startsWith("http") ? w : `https://${w}`).hostname.replace(/^www\./, "").toLowerCase(); } catch { return w.trim().toLowerCase(); } };

function downloadModel() {
  const csv = "empresa,telefone,email,website,cidade,setor,endereco\nExemplo Ltda,+55 11 90000-0000,contato@exemplo.com,https://exemplo.com,São Paulo,Restaurantes,Rua Exemplo 123\n";
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "modelo_leads.csv"; a.click(); URL.revokeObjectURL(a.href);
}

export function ImportCsvModal({ accountId, userId, existing, onDone, onClose }: { accountId?: string; userId?: string; existing: { phone: string | null; website: string | null }[]; onDone: () => void; onClose: () => void }) {
  const { lang } = useLang();
  const D = DICT[lang];
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; dup: number; err: number } | null>(null);
  const root = document.querySelector(".ml-root") as HTMLElement | null;
  if (!root) return null;

  function onPick(f: File) {
    setFileName(f.name); setErr(null);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.readAsText(f);
  }

  async function doImport() {
    setErr(null);
    if (!text.trim()) { setErr(D.noFile); return; }
    if (!accountId || !userId) return;
    const rows = parseCsv(text);
    if (rows.length < 2) { setErr(D.noRows); return; }

    const header = rows[0].map(norm);
    const colOf: Record<string, number> = {};
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      const idx = header.findIndex((h) => aliases.includes(h));
      if (idx >= 0) colOf[field] = idx;
    }
    if (colOf.company === undefined) { setErr(D.noRows); return; }

    const seenPhones = new Set(existing.map((e) => normPhone(e.phone ?? undefined)).filter(Boolean));
    const seenSites = new Set(existing.map((e) => normSite(e.website ?? undefined)).filter(Boolean));

    const toInsert: Record<string, unknown>[] = [];
    let dup = 0, errCount = 0;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const get = (f: string) => (colOf[f] !== undefined ? (r[colOf[f]] ?? "").trim() : "");
      const company = get("company");
      if (!company) { errCount++; continue; }
      const phone = get("phone") || null, website = get("website") || null, email = get("email") || null;
      const np = normPhone(phone ?? undefined), ns = normSite(website ?? undefined);
      if ((np && seenPhones.has(np)) || (ns && seenSites.has(ns))) { dup++; continue; }
      if (np) seenPhones.add(np); if (ns) seenSites.add(ns);
      const address = get("address") || null;
      const nq = 5;
      toInsert.push({
        company_name: company, phone, email, website, address,
        location: get("location") || null, industry: get("industry") || null,
        account_id: accountId, user_id: userId, source: "import", status: "new",
        niche_quality: nq, score: scoreOf({ phone, address, email, website, nicheQuality: nq }),
      });
    }

    if (!toInsert.length) { setResult({ imported: 0, dup, err: errCount }); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.from("leads").insert(toInsert).select("id");
      if (error) throw error;
      const ids = data ?? [];
      if (ids.length) await supabase.from("lead_events").insert(ids.map((l) => ({ lead_id: l.id, account_id: accountId, type: "created", payload: { source: "import" } })));
      setResult({ imported: ids.length, dup, err: errCount });
      onDone();
    } catch { setErr(D.failed); }
    finally { setBusy(false); }
  }

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,12,40,.5)", display: "grid", placeItems: "center", zIndex: 1000, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 18, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", color: "#fff", display: "grid", placeItems: "center" }}><Icon name="plus" size={18} /></div>
          <div style={{ fontSize: 17, fontWeight: 800 }}>{D.title}</div>
        </div>

        {!result && (
          <>
            <div style={{ fontSize: 12.5, color: "var(--ml-muted)", margin: "8px 0 16px", lineHeight: 1.5 }}>{D.cols}</div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => fileRef.current?.click()} style={btnGhost}><Icon name="plus" size={15} /> {D.pick}</button>
              <button onClick={downloadModel} style={btnGhost}><Icon name="chart" size={15} /> {D.model}</button>
            </div>
            {fileName && <div style={{ marginTop: 12, fontSize: 13, color: "var(--ml-text)" }}>{D.selected}: <b>{fileName}</b></div>}
            {err && <div style={{ marginTop: 12, fontSize: 13, color: "var(--ml-red)", background: "rgba(239,68,68,.1)", padding: "10px 12px", borderRadius: 10 }}>{err}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              <button onClick={doImport} disabled={busy || !text} style={{ ...btnPrimary(busy), opacity: busy || !text ? 0.6 : 1 }}>{busy ? <Icon name="loader" size={15} className="ml-spin" /> : <Icon name="check" size={15} />}{busy ? D.importing : D.doImport}</button>
              <button onClick={onClose} disabled={busy} style={btnGhost}>{D.cancel}</button>
            </div>
          </>
        )}

        {result && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 14px" }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "rgba(16,185,129,.14)", display: "grid", placeItems: "center", color: "var(--ml-green)" }}><Icon name="check" size={17} /></div>
              <div style={{ fontWeight: 700 }}>{D.okTitle}</div>
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 13.5, marginBottom: 18 }}>
              <span><b style={{ color: "var(--ml-green)", fontSize: 18 }}>{result.imported}</b> {D.imported}</span>
              {result.dup > 0 && <span style={{ color: "var(--ml-muted)" }}><b>{result.dup}</b> {D.dup}</span>}
              {result.err > 0 && <span style={{ color: "var(--ml-muted)" }}><b>{result.err}</b> {D.err}</span>}
            </div>
            <button onClick={onClose} style={btnPrimary(false)}>{D.close}</button>
          </div>
        )}
      </div>
    </div>,
    root
  );
}

const btnPrimary = (busy: boolean): CSSProperties => ({ display: "flex", alignItems: "center", gap: 7, padding: "11px 20px", borderRadius: 11, border: "none", background: "linear-gradient(135deg,var(--ml-primary),var(--ml-primary-2))", color: "#fff", fontWeight: 700, fontSize: 14, cursor: busy ? "default" : "pointer" });
const btnGhost: CSSProperties = { display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 11, border: "1px solid var(--ml-border)", background: "var(--ml-card)", color: "var(--ml-navtext)", fontWeight: 600, fontSize: 13.5, cursor: "pointer" };
