"use client";
import { Icono } from "@/components/ui/Icono";
import Link from "next/link";
import { useEffect, useRef } from "react";

/** `recargar`: el href se abre con navegación completa (así una pantalla con cambios sin guardar puede avisar antes). */
export type Pestana = { clave: string; texto: string; emoji?: string; href?: string; recargar?: boolean; marca?: string };

/**
 * Pestañas: con href navegan (cada pestaña es una ruta, se puede compartir el link);
 * sin href, cambian el estado de la pantalla. En el celular se deslizan.
 */
export function Pestanas({ pestanas, activa, alCambiar, etiqueta }: {
  pestanas: Pestana[]; activa: string; alCambiar?: (clave: string) => void; etiqueta: string;
}) {
  // En el celular la fila se desliza: la pestaña activa queda a la vista (sin mover la página).
  const fila = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const f = fila.current;
    const el = f?.querySelector<HTMLElement>('[aria-selected="true"], [aria-current="page"]');
    if (!f || !el) return;
    const izq = el.offsetLeft - f.offsetLeft, der = izq + el.offsetWidth;
    if (izq < f.scrollLeft || der > f.scrollLeft + f.clientWidth) f.scrollLeft = Math.max(0, izq - 16);
  }, [activa]);
  return (
    <div ref={fila} className="pestanas" role="tablist" aria-label={etiqueta}>
      {pestanas.map((p) => {
        const contenido = <>{p.emoji && <span aria-hidden><Icono nombre={p.emoji} sistema /></span>}{p.texto}{p.marca && <span className="text-[var(--acento)]" aria-label={p.marca}>•</span>}</>;
        if (p.href && p.recargar) return <a key={p.clave} href={p.href} className="pestana">{contenido}</a>;
        return p.href
          ? <Link key={p.clave} href={p.href} className="pestana" aria-current={p.clave === activa ? "page" : undefined}>{contenido}</Link>
          : <button key={p.clave} type="button" role="tab" className="pestana" aria-selected={p.clave === activa} data-pestana={p.clave} onClick={() => alCambiar?.(p.clave)}>{contenido}</button>;
      })}
    </div>
  );
}
