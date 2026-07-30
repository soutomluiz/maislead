import type { CSSProperties } from "react";

/**
 * Logo oficial do maisLEAD (imagem, não mais texto estilizado).
 * - theme="color"  → logo-colorida.png, para fundos CLAROS/brancos
 * - theme="white"  → logo-white.png, para fundos ROXOS/escuros
 * A imagem é um wordmark horizontal (proporção ~2.74:1); passamos só a altura
 * e deixamos a largura automática pra manter a proporção.
 */
export function Logo({
  theme = "color",
  height = 34,
  style,
  className,
}: {
  theme?: "color" | "white";
  height?: number;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <img
      src={theme === "white" ? "/logo-white.png" : "/logo-colorida.png"}
      alt="maisLEAD"
      className={className}
      style={{ height, width: "auto", display: "block", ...style }}
    />
  );
}
