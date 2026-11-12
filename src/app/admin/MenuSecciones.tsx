"use client";
import { useEffect, useState } from "react";

export type SeccionAdmin = { id: string; titulo: string };

/** Menú de las 4 secciones de la portada: salta a cada una y marca la que se está mirando. */
export function MenuSecciones({ secciones }: { secciones: SeccionAdmin[] }) {
  const [activa, setActiva] = useState(secciones[0]?.id ?? "");
  useEffect(() => {
    const vistas = new Map<string, number>();
    const obs = new IntersectionObserver((entradas) => {
      for (const e of entradas) vistas.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
      const mejor = [...vistas.entries()].sort((a, b) => b[1] - a[1])[0];
      if (mejor && mejor[1] > 0) setActiva(mejor[0]);
    }, { rootMargin: "-80px 0px -55% 0px", threshold: [0, 0.1, 0.5, 1] });
    for (const s of secciones) { const el = document.getElementById(s.id); if (el) obs.observe(el); }
    return () => obs.disconnect();
  }, [secciones]);
  return (
    <nav aria-label="Secciones de la portada" data-menu-secciones
      className="sticky top-0 z-20 -mx-4 sm:-mx-8 px-4 sm:px-8 py-2 bg-[var(--fondo)] border-b border-[var(--borde)] flex gap-2 overflow-x-auto">
      {secciones.map((s) => (
        <a key={s.id} href={`#${s.id}`} data-seccion-menu={s.id} aria-current={activa === s.id ? "true" : undefined}
          className={`boton shrink-0 ${activa === s.id ? "!border-[var(--acento)]" : "texto-suave"}`}>{s.titulo}</a>
      ))}
    </nav>
  );
}
