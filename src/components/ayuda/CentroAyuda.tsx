"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { buscarPreguntas, type PreguntaAyuda } from "@/lib/ayuda-preguntas";

/**
 * VD-63 · El centro de ayuda (panel y app del socio): preguntas cortas, buscables, cada una con el botón que lleva a hacerlo.
 * `abierta` es la pregunta que se pidió por link (?p=…, por ejemplo desde Ctrl+K): sale abierta, con su botón, y a la vista.
 */
export function CentroAyuda({ preguntas, abierta = null, version }: { preguntas: PreguntaAyuda[]; abierta?: string | null; version: string }) {
  const [texto, setTexto] = useState("");
  const [abiertas, setAbiertas] = useState<Set<string>>(() => new Set(abierta && preguntas.some((p) => p.id === abierta) ? [abierta] : []));
  const marcada = useRef<HTMLElement | null>(null);
  useEffect(() => { marcada.current?.scrollIntoView({ block: "center" }); }, []);

  const visibles = useMemo(() => (texto.trim() ? buscarPreguntas(preguntas, texto, 30) : preguntas), [preguntas, texto]);
  // Agrupadas por pantalla, en el orden en que aparecen.
  const grupos = useMemo(() => {
    const m = new Map<string, PreguntaAyuda[]>();
    for (const p of visibles) m.set(p.pantalla, [...(m.get(p.pantalla) ?? []), p]);
    return [...m];
  }, [visibles]);
  const alternar = (id: string) => setAbiertas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="space-y-6 max-w-3xl" data-centro-ayuda>
      <label className="block">
        <span className="sr-only">Buscar una pregunta</span>
        <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} className="campo" placeholder="Buscá: “anular un cobro”, “pausar”, “día fijo”…" data-ayuda-buscar autoComplete="off" />
      </label>
      {grupos.length === 0 && (
        <p className="texto-suave py-6 text-center" data-ayuda-vacia>No encontramos una pregunta con “{texto.trim()}”. Probá con otra palabra o escribile al gimnasio.</p>
      )}
      {grupos.map(([pantalla, items]) => (
        <section key={pantalla} className="space-y-2" aria-label={pantalla}>
          <h2 className="titulo-grupo px-1">{pantalla}</h2>
          <ul className="space-y-2">
            {items.map((p) => {
              const on = abiertas.has(p.id);
              return (
                <li key={p.id} id={p.id} data-pregunta={p.id} data-abierta={on ? "si" : "no"} ref={(el) => { if (p.id === abierta) marcada.current = el; }}
                  className={`tarjeta scroll-mt-24 ${p.id === abierta ? "outline outline-2 outline-[var(--acento)]" : ""}`}>
                  <button type="button" onClick={() => alternar(p.id)} aria-expanded={on} aria-controls={`r-${p.id}`}
                    className="w-full flex items-center gap-3 px-5 py-4 min-h-14 text-left cursor-pointer">
                    <span className="flex-1 min-w-0 font-semibold">{p.pregunta}</span>
                    <span aria-hidden className="texto-tenue flex-none">{on ? "−" : "+"}</span>
                  </button>
                  {on && (
                    <div id={`r-${p.id}`} className="px-5 pb-5 -mt-1 space-y-4">
                      <p className="texto-suave" data-respuesta>{p.respuesta}</p>
                      <Link href={p.destino.ruta} className="boton boton-principal" data-ayuda-boton-destino={p.id}>{p.destino.boton} →</Link>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <p className="texto-tenue text-sm" data-ayuda-version>Textos de ayuda · versión {version}</p>
    </div>
  );
}
