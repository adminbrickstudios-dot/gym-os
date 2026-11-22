"use client";
import { useState, useTransition } from "react";
import { guardarLlaveLandingVenta } from "./acciones";

/** La llave de la página de venta nueva: el público la ve solo prendida. Se puede apagar en cualquier momento (vuelve la de siempre). */
export function LlaveLandingVenta({ prendida }: { prendida: boolean }) {
  const [estado, setEstado] = useState(prendida);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3" data-llave-landing-venta={estado ? "prendida" : "apagada"}>
      <span className="texto-suave">{estado ? "El público ve esta página." : "El público ve la página de siempre."}</span>
      <button type="button" className={`boton ${estado ? "" : "boton-principal"}`} disabled={pendiente}
        onClick={() => empezar(async () => {
          setError(null);
          const r = await guardarLlaveLandingVenta(!estado);
          if (r.error) setError(r.error); else setEstado(!estado);
        })}>
        {pendiente ? "Guardando…" : estado ? "Volver a la página de siempre" : "Publicar esta página"}
      </button>
      {error && <p role="alert" className="w-full text-[var(--rojo)]">{error}</p>}
    </div>
  );
}
