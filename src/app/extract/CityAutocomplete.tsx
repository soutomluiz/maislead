import {
  useState,
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

/**
 * CityAutocomplete — campo de cidade com sugestões via Nominatim (OpenStreetMap).
 *
 * Segue o padrão visual de ExtractionScreen (inline styles + CSS vars).
 * Quando o usuário seleciona uma cidade, chama onSelect com:
 *   - label: nome formatado ("Biguaçu, Santa Catarina, Brazil")
 *   - bbox: { min_lon, min_lat, max_lon, max_lat }  <- pronto pro Overture
 *   - lat, lon: coordenadas do centro (caso precise)
 *
 * Também mantém compatibilidade com o fluxo antigo: o texto digitado
 * continua disponível via onTextChange, pra não quebrar nada que dependa
 * do valor livre.
 */

export type CitySelection = {
  label: string;
  bbox: { min_lon: number; min_lat: number; max_lon: number; max_lat: number };
  lat: number;
  lon: number;
};

type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: [string, string, string, string]; // [south, north, west, east]
  addresstype?: string;
  type?: string;
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
  };
};

/**
 * Monta um rótulo limpo tipo "Biguaçu, Santa Catarina, Brasil"
 * a partir do endereço estruturado, com fallback pro display_name.
 */
function cleanLabel(r: NominatimResult): string {
  const a = r.address || {};
  const cityName =
    a.city || a.town || a.village || a.municipality || r.name || "";
  const parts = [cityName, a.state, a.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : r.display_name;
}

type Props = {
  value: string;
  onTextChange: (text: string) => void;
  onSelect: (selection: CitySelection) => void;
  placeholder?: string;
  label?: string;
  labelStyle?: CSSProperties;
  inputStyle?: CSSProperties;
  onEnter?: () => void;
};

export function CityAutocomplete({
  value,
  onTextChange,
  onSelect,
  placeholder,
  label,
  labelStyle,
  inputStyle,
  onEnter,
}: Props) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Evita buscar de novo logo após uma seleção (senão reabre o dropdown)
  const justSelectedRef = useRef(false);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Busca com debounce de 350ms
  useEffect(() => {
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = value.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const url =
          "https://nominatim.openstreetmap.org/search?" +
          new URLSearchParams({
            q,
            format: "jsonv2",
            addressdetails: "1",
            limit: "8",
            // layer=address restringe a lugares administrativos/endereços,
            // e o filtro de tipo abaixo mantém só cidade/vila/município.
            layer: "address",
          }).toString();

        const res = await fetch(url, {
          headers: {
            "Accept-Language": navigator.language || "pt-BR",
          },
        });
        const data: NominatimResult[] = await res.json();

        // Só interessam lugares que representam uma CIDADE/município —
        // não rua, avenida, loteamento, CEP, etc.
        const CITY_TYPES = [
          "city",
          "town",
          "village",
          "municipality",
          "administrative",
          "hamlet",
        ];
        const cities = data.filter((r) => {
          const t = r.addresstype || r.type || "";
          return CITY_TYPES.includes(t);
        });

        setSuggestions(cities);
        setOpen(cities.length > 0);
        setHighlight(-1);
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  function pick(r: NominatimResult) {
    const [south, north, west, east] = r.boundingbox.map(Number);
    const label = cleanLabel(r);
    justSelectedRef.current = true;
    onTextChange(label);
    onSelect({
      label,
      lat: Number(r.lat),
      lon: Number(r.lon),
      bbox: {
        min_lon: west,
        min_lat: south,
        max_lon: east,
        max_lat: north,
      },
    });
    setOpen(false);
    setSuggestions([]);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (open && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(h - 1, 0));
        return;
      }
      if (e.key === "Enter" && highlight >= 0) {
        e.preventDefault();
        pick(suggestions[highlight]);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
    }
    if (e.key === "Enter" && onEnter) onEnter();
  }

  // Estilos padrão (podem ser sobrescritos via props pra casar com o resto da tela)
  const defaultLabel: CSSProperties = labelStyle || {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: "var(--ml-text)",
  };
  const defaultInput: CSSProperties = inputStyle || {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid var(--ml-border)",
    background: "var(--ml-bg)",
    color: "var(--ml-text)",
    fontSize: 14,
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      {label && <label style={defaultLabel}>{label}</label>}
      <input
        value={value}
        onChange={(e) => onTextChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        style={defaultInput}
        autoComplete="off"
      />
      {loading && (
        <span
          style={{
            position: "absolute",
            right: 12,
            top: label ? 36 : 11,
            fontSize: 12,
            color: "var(--ml-muted, #888)",
          }}
        >
          …
        </span>
      )}
      {open && suggestions.length > 0 && (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 50,
            margin: "4px 0 0",
            padding: 4,
            listStyle: "none",
            background: "var(--ml-bg, #fff)",
            border: "1px solid var(--ml-border)",
            borderRadius: 8,
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          {suggestions.map((r, i) => (
            <li
              key={`${r.lat}-${r.lon}-${i}`}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(r);
              }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                padding: "8px 10px",
                borderRadius: 6,
                fontSize: 13,
                cursor: "pointer",
                background:
                  i === highlight ? "var(--ml-primary-soft, #eef)" : "transparent",
                color: "var(--ml-text)",
              }}
            >
              {cleanLabel(r)}
            </li>
          ))}
          <li
            style={{
              padding: "6px 10px 4px",
              fontSize: 10,
              color: "var(--ml-muted, #999)",
              textAlign: "right",
            }}
          >
            dados © OpenStreetMap
          </li>
        </ul>
      )}
    </div>
  );
}
