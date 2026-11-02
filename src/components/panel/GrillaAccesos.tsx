"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { guardarAccesos } from "@/app/panel/acciones";
import type { Acceso } from "@/lib/panel/secciones";

/**
 * Los botones grandes del inicio. El primero es el principal (con el color
 * del gimnasio); el resto, blancos sobre la tarjeta. Cada persona elige los
 * suyos y el orden.
 */
export function GrillaAccesos({ elegidos, disponibles, perdidos }: { elegidos: Acceso[]; disponibles: Acceso[]; perdidos: string[] }) {
  const [editando, setEditando] = useState(false);
  const [seleccion, setSeleccion] = useState(elegidos.map((a) => a.clave));
  const [error, setError] = useState<string | null>(null);
  const [guardando, empezar] = useTransition();

  if (!editando) {
    return (
      <section aria-label="Accesos rápidos">
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {elegidos.map((a, i) => (
            <li key={a.clave}>
              <Link href={a.ruta} className={`boton ${i === 0 ? "boton-principal" : ""} !flex-col !items-start !justify-between w-full aspect-[4/3] sm:aspect-[5/3] !p-4 sm:!p-5 !rounded-[var(--radio-grande)]`}>
                <span className="text-4xl" aria-hidden>{a.emoji}</span>
                <span className="titulo text-xl sm:text-2xl text-left">{a.titulo}</span>
              </Link>
            </li>
          ))}
        </ul>
        {perdidos.length > 0 && (
          <p className="pildora pildora-amarillo mt-3">⚠️ {perdidos.length === 1 ? "Un acceso que tenías ya no está disponible" : `${perdidos.length} accesos que tenías ya no están disponibles`}: elegí de nuevo.</p>
        )}
        <button type="button" onClick={() => setEditando(true)} className="mt-3 text-sm texto-tenue hover:text-[var(--texto)] px-1 min-h-11">✏️ Elegir mis accesos</button>
      </section>
    );
  }

  const alternar = (c: string) => setSeleccion((s) => (s.includes(c) ? s.filter((x) => x !== c) : s.length >= 9 ? s : [...s, c]));
  return (
    <section aria-label="Elegir accesos rápidos" className="tarjeta p-4 sm:p-6">
      <p className="titulo text-2xl">Elegí tus accesos</p>
      <p className="texto-suave mt-1">Tocá en el orden que los querés. El primero va en grande y con color. Hasta 9.</p>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5">
        {disponibles.map((a) => {
          const pos = seleccion.indexOf(a.clave);
          return (
            <li key={a.clave}>
              <button type="button" onClick={() => alternar(a.clave)} aria-pressed={pos >= 0}
                className={`boton w-full !justify-start ${pos >= 0 ? "!border-[var(--acento)]" : "opacity-70"}`}>
                <span aria-hidden>{a.emoji}</span>
                <span className="flex-1 text-left">{a.titulo}</span>
                {pos >= 0 && <span className="numero text-lg" style={{ color: "var(--acento)" }}>{pos + 1}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="pildora pildora-rojo mt-4">⚠️ {error}</p>}
      <div className="flex gap-2 mt-5">
        <button type="button" disabled={guardando || seleccion.length === 0} className="boton boton-principal"
          onClick={() => empezar(async () => {
            const r = await guardarAccesos(seleccion);
            if (r.error) setError(r.error); else { setError(null); setEditando(false); }
          })}>
          {guardando ? "Guardando…" : "✅ Guardar"}
        </button>
        <button type="button" className="boton" onClick={() => { setSeleccion(elegidos.map((a) => a.clave)); setEditando(false); setError(null); }}>Cancelar</button>
      </div>
    </section>
  );
}
