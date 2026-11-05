import Link from "next/link";
import type { ReactNode } from "react";

/** Un número grande con su etiqueta chica. Si tiene href, se toca y lleva al detalle. */
export function Dato({ valor, etiqueta, href, tono }: { valor: ReactNode; etiqueta: string; href?: string; tono?: "verde" | "amarillo" | "rojo" }) {
  const color = tono ? { color: `var(--${tono})` } : undefined;
  const cuerpo = (
    <>
      <span className="numero text-4xl sm:text-5xl block" style={color}>{valor}</span>
      <span className="text-sm texto-tenue block mt-1">{etiqueta}</span>
    </>
  );
  return href
    ? <Link href={href} className="block rounded-2xl p-2 -m-2 hover:bg-[var(--tarjeta)] active:scale-[0.98] transition">{cuerpo}</Link>
    : <div>{cuerpo}</div>;
}
