"use client";
// VD-21 · "Buscar una opción": escribís una palabra y te lleva a la opción, con su pestaña y resaltada.
import { useState } from "react";
import { buscarOpciones, type Opcion } from "./indice";
import { PESTANAS } from "./pestanas";

const NOMBRE_PESTANA = Object.fromEntries(PESTANAS.map((p) => [p.clave, `${p.emoji} ${p.texto}`]));

export function BuscadorConfig({ visible, alElegir }: { visible: (o: Opcion) => boolean; alElegir: (o: Opcion) => void }) {
  const [texto, setTexto] = useState("");
  const resultados = buscarOpciones(texto, visible);
  const buscando = texto.trim().length > 0;
  return (
    <div className="space-y-2" data-buscador-config>
      <label className="block">
        <span className="sr-only">Buscar una opción</span>
        <input type="search" className="campo" placeholder="🔍 Buscar una opción: reingreso, caja, fiado, meta…" autoComplete="off" enterKeyHint="search"
          value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Buscar una opción" data-buscar-opcion />
      </label>
      {buscando && (
        resultados.length === 0
          ? <p className="texto-suave" data-sin-resultados>No encontramos esa opción. Probá con otra palabra: “cobrar”, “vence”, “entrada”, “mensajes”.</p>
          : (
            <ul className="tarjeta divide-y divide-[var(--borde)] overflow-hidden" data-resultados-config>
              {resultados.map((o) => (
                <li key={o.id}>
                  <button type="button" className="w-full text-left p-3 space-y-0.5 hover:bg-[var(--tarjeta-alta)]" data-resultado={o.id}
                    onClick={() => { alElegir(o); setTexto(""); }}>
                    <span className="flex flex-wrap items-center gap-2"><span className="font-semibold">{o.titulo}</span><span className="pildora">{NOMBRE_PESTANA[o.pestana]}</span></span>
                    <span className="block text-sm texto-suave">{o.explicacion}</span>
                    {o.recomendado && <span className="block text-sm texto-tenue">Recomendado: {o.recomendado}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )
      )}
    </div>
  );
}
