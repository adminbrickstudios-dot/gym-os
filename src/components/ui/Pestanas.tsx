"use client";
import Link from "next/link";

/** `recargar`: el href se abre con navegación completa (así una pantalla con cambios sin guardar puede avisar antes). */
export type Pestana = { clave: string; texto: string; emoji?: string; href?: string; recargar?: boolean; marca?: string };

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
        const contenido = <>{p.emoji && <span aria-hidden>{p.emoji}</span>}{p.texto}{p.marca && <span className="text-[var(--acento)]" aria-label={p.marca}>•</span>}</>;
        if (p.href && p.recargar) return <a key={p.clave} href={p.href} className="pestana">{contenido}</a>;
        return p.href
          ? <Link key={p.clave} href={p.href} className="pestana" aria-current={p.clave === activa ? "page" : undefined}>{contenido}</Link>
          : <button key={p.clave} type="button" role="tab" className="pestana" aria-selected={p.clave === activa} data-pestana={p.clave} onClick={() => alCambiar?.(p.clave)}>{contenido}</button>;
      })}
    </div>
  );
}
