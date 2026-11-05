"use client";
import { useState, useTransition } from "react";
import { cancelarReserva } from "./acciones";

export function CancelarReserva({ reservaId }: { reservaId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <>
      <button type="button" disabled={ocupado} className="boton-texto" onClick={() => empezar(async () => { const r = await cancelarReserva(reservaId); setError(r.error ?? null); })}>Cancelar</button>
      {error && <p role="alert" className="pildora pildora-rojo w-full">⚠️ {error}</p>}
    </>
  );
}
