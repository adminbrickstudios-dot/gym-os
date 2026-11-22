// Vuelta final (22/11) · los dibujos propios de Pase para la página del gimnasio (DISENO.md § Página del gimnasio).
// Trazo de Pista: línea de 2,25 con puntas redondas en currentColor (el texto suave del modo), y UNA mancha de relleno por
// dibujo en el color del gimnasio (var(--acento)). Sin degradés, sin sombras, sin JS: SVG inline que pesa unos cientos de bytes
// y se ve igual en claro y en oscuro. Son decorativos: aria-hidden siempre (el texto de la página dice todo).
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { titulo?: never };
const base = (viewBox: string, p: P) => ({
  viewBox, fill: "none", stroke: "currentColor", strokeWidth: 2.25, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  "aria-hidden": true as const, focusable: "false" as const, ...p,
});
const ACENTO = "var(--acento)";

/** Barra olímpica con dos discos por lado: los grandes en el acento. */
export function Barra(p: P) {
  return (
    <svg {...base("0 0 200 80", p)} data-ilustracion="barra">
      <path d="M6 40h188" />
      <rect x="30" y="10" width="14" height="60" rx="4" fill={ACENTO} stroke="none" />
      <rect x="156" y="10" width="14" height="60" rx="4" fill={ACENTO} stroke="none" />
      <rect x="46" y="20" width="9" height="40" rx="3" />
      <rect x="145" y="20" width="9" height="40" rx="3" />
      <path d="M60 33v14M140 33v14" />
      <path d="M82 37v6M92 37v6M108 37v6M118 37v6" strokeWidth="1.5" />
    </svg>
  );
}

/** Mancuerna hexagonal. */
export function Mancuerna(p: P) {
  return (
    <svg {...base("0 0 120 60", p)} data-ilustracion="mancuerna">
      <path d="M14 14l10-6 10 6v32l-10 6-10-6z" fill={ACENTO} stroke="none" />
      <path d="M86 14l10-6 10 6v32l-10 6-10-6z" fill={ACENTO} stroke="none" />
      <path d="M34 30h52" strokeWidth="5" />
      <path d="M48 26v8M60 26v8M72 26v8" strokeWidth="1.5" />
    </svg>
  );
}

/** Kettlebell: la campana en el acento, el asa de línea. */
export function Kettlebell(p: P) {
  return (
    <svg {...base("0 0 80 90", p)} data-ilustracion="kettlebell">
      <path d="M24 34V24a16 16 0 0 1 32 0v10" />
      <path d="M14 58a26 26 0 1 1 52 0c0 10-4 18-10 24H24c-6-6-10-14-10-24z" fill={ACENTO} stroke="none" />
      <path d="M30 82h20" />
    </svg>
  );
}

/** Banco plano con su apoyo. */
export function Banco(p: P) {
  return (
    <svg {...base("0 0 160 80", p)} data-ilustracion="banco">
      <rect x="14" y="26" width="132" height="14" rx="7" fill={ACENTO} stroke="none" />
      <path d="M34 40v30M126 40v30M22 70h24M114 70h24M80 40v18" />
    </svg>
  );
}

/** Soga de saltar: los mangos en el acento, la soga en una sola curva. */
export function Soga(p: P) {
  return (
    <svg {...base("0 0 140 90", p)} data-ilustracion="soga">
      <path d="M26 30c0 60 88 60 88 0" />
      <rect x="18" y="6" width="16" height="26" rx="8" fill={ACENTO} stroke="none" />
      <rect x="106" y="6" width="16" height="26" rx="8" fill={ACENTO} stroke="none" />
    </svg>
  );
}

/** Cronómetro: la corona en el acento, la aguja marcando. */
export function Cronometro(p: P) {
  return (
    <svg {...base("0 0 80 90", p)} data-ilustracion="cronometro">
      <rect x="32" y="4" width="16" height="9" rx="3" fill={ACENTO} stroke="none" />
      <circle cx="40" cy="52" r="30" />
      <path d="M40 52V34M40 52l12 8" />
      <path d="M64 22l6-6" />
    </svg>
  );
}

/** La línea de una pista: dos carriles que doblan. Es la firma de Pista; va detrás de la portada. */
export function LineaPista(p: P) {
  return (
    <svg {...base("0 0 600 220", { preserveAspectRatio: "none", ...p })} data-ilustracion="pista">
      <path d="M-10 200H330a110 110 0 0 0 0-220" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <path d="M-10 170H330a80 80 0 0 0 0-160" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeDasharray="10 10" />
      <path d="M-10 140H330a50 50 0 0 0 0-100" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export const ILUSTRACIONES = { Barra, Mancuerna, Kettlebell, Banco, Soga, Cronometro, LineaPista };
