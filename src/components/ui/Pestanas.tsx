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
  const fila = useRef<HTMLElement>(null);
  useEffect(() => {
    const f = fila.current;
    const el = f?.querySelector<HTMLElement>('[aria-selected="true"], [aria-current="page"]');
    if (!f || !el) return;
    const izq = el.offsetLeft - f.offsetLeft, der = izq + el.offsetWidth;
    if (izq < f.scrollLeft || der > f.scrollLeft + f.clientWidth) f.scrollLeft = Math.max(0, izq - 16);
  }, [activa]);
  // Accesibilidad (Lighthouse): las que navegan son links dentro de un <nav> (aria-current marca la de ahora); las que cambian el estado
  // de la pantalla son botones role="tab" dentro de un role="tablist". Un tablist con links adentro no es válido.
  const navegan = pestanas.some((p) => p.href);
  const Contenedor = navegan ? "nav" : "div";
  return (
    <Contenedor ref={fila as React.RefObject<HTMLDivElement>} className="pestanas" role={navegan ? undefined : "tablist"} aria-label={etiqueta}>
      {pestanas.map((p) => {
        const contenido = <>{p.emoji && <span aria-hidden><Icono nombre={p.emoji} sistema /></span>}{p.texto}{p.marca && <span className="inline-block size-2 rounded-full bg-[var(--acento)]" role="img" aria-label={p.marca} />}</>;
        if (p.href && p.recargar) return <a key={p.clave} href={p.href} className="pestana" aria-current={p.clave === activa ? "page" : undefined}>{contenido}</a>;
        return p.href
          ? <Link key={p.clave} href={p.href} className="pestana" aria-current={p.clave === activa ? "page" : undefined}>{contenido}</Link>
          : <button key={p.clave} type="button" role="tab" className="pestana" aria-selected={p.clave === activa} data-pestana={p.clave} onClick={() => alCambiar?.(p.clave)}>{contenido}</button>;
      })}
    </Contenedor>
  );
}
