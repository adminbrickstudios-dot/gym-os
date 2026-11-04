"use client";
import Link from "next/link";

export type Pestana = { clave: string; texto: string; emoji?: string; href?: string };

/**
 * Pestañas: con href navegan (cada pestaña es una ruta, se puede compartir el link);
 * sin href, cambian el estado de la pantalla. En el celular se deslizan.
 */
export function Pestanas({ pestanas, activa, alCambiar, etiqueta }: {
  pestanas: Pestana[]; activa: string; alCambiar?: (clave: string) => void; etiqueta: string;
}) {
  return (
    <div className="pestanas" role="tablist" aria-label={etiqueta}>
      {pestanas.map((p) => {
        const contenido = <>{p.emoji && <span aria-hidden>{p.emoji}</span>}{p.texto}</>;
        return p.href
          ? <Link key={p.clave} href={p.href} className="pestana" aria-current={p.clave === activa ? "page" : undefined}>{contenido}</Link>
          : <button key={p.clave} type="button" role="tab" className="pestana" aria-selected={p.clave === activa} onClick={() => alCambiar?.(p.clave)}>{contenido}</button>;
      })}
    </div>
  );
}
