import { useEffect, useRef, useState, type CSSProperties } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Icon } from "../icons";

// Seleção múltipla de CNAE com busca. Carrega a lista 1x (cache de módulo) e filtra ao digitar.
type Cnae = { codigo: string; descricao: string };
let CACHE: Cnae[] | null = null;

const T = {
  pt: { ph: "Buscar atividade (CNAE)…", loading: "Carregando CNAEs…", none: "Nenhum CNAE encontrado", selected: "selecionados" },
  en: { ph: "Search activity (CNAE)…", loading: "Loading CNAEs…", none: "No CNAE found", selected: "selected" },
  es: { ph: "Buscar actividad (CNAE)…", loading: "Cargando CNAEs…", none: "Ningún CNAE encontrado", selected: "seleccionados" },
};

export function CnaeSelect({ value, onChange, lang }: { value: string[]; onChange: (codes: string[]) => void; lang: "pt" | "en" | "es" }) {
  const D = T[lang];
  const [list, setList] = useState<Cnae[]>(CACHE ?? []);
  const [loading, setLoading] = useState(!CACHE);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (CACHE) return;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("search-receita", { body: { mode: "cnaes" } });
        CACHE = (data?.cnaes ?? []) as Cnae[];
        setList(CACHE);
      } catch { /* ignora */ }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const byCode = new Map(list.map((c) => [c.codigo, c.descricao]));
  const qn = q.trim().toLowerCase();
  const qDigits = q.replace(/\D/g, "");
  const filtered = qn
    ? list.filter((c) => !value.includes(c.codigo) && (c.descricao.toLowerCase().includes(qn) || (qDigits && c.codigo.includes(qDigits)))).slice(0, 40)
    : [];

  const add = (c: Cnae) => { onChange([...value, c.codigo]); setQ(""); };
  const remove = (code: string) => onChange(value.filter((v) => v !== code));

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <label style={lbl}>{lang === "pt" ? "Atividade (CNAE)" : lang === "en" ? "Activity (CNAE)" : "Actividad (CNAE)"}{value.length > 0 ? ` · ${value.length} ${D.selected}` : ""}</label>
      <div onClick={() => setOpen(true)} style={{ minHeight: 42, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: "6px 10px", borderRadius: 12, border: "1px solid var(--ml-border)", background: "var(--ml-input)", cursor: "text" }}>
        {value.map((code) => (
          <span key={code} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--ml-primary)", background: "rgba(109,92,245,.12)", padding: "3px 6px 3px 9px", borderRadius: 16, maxWidth: 240 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{byCode.get(code) ?? code}</span>
            <button onClick={(e) => { e.stopPropagation(); remove(code); }} style={{ display: "grid", placeItems: "center", background: "none", border: "none", color: "var(--ml-primary)", cursor: "pointer", padding: 0, flexShrink: 0 }}><Icon name="x" size={12} strokeWidth={2.6} /></button>
          </span>
        ))}
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={value.length === 0 ? (loading ? D.loading : D.ph) : ""}
          style={{ flex: 1, minWidth: 120, border: "none", outline: "none", background: "transparent", color: "var(--ml-text)", fontSize: 14, height: 28 }}
        />
      </div>

      {open && qn && (
        <div className="ml-scroll" style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, maxHeight: 260, overflowY: "auto", background: "var(--ml-card)", border: "1px solid var(--ml-border)", borderRadius: 12, boxShadow: "0 14px 40px rgba(20,17,40,.2)", zIndex: 30, padding: 6 }}>
          {filtered.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--ml-muted)", padding: "10px 12px" }}>{loading ? D.loading : D.none}</div>
          ) : filtered.map((c) => (
            <button key={c.codigo} onClick={() => add(c)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 9, border: "none", background: "none", cursor: "pointer", color: "var(--ml-text)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ml-hover)")} onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ml-muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{c.codigo}</span>
              <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.descricao}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const lbl: CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--ml-navtext)", marginBottom: 7 };
