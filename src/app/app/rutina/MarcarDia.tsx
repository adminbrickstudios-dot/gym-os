"use client";
import { useState, useTransition } from "react";
import { marcarDiaHecho } from "./acciones";

/** VD-20: el botón grande de "Hice el Día N" (y deshacer si fue sin querer). */
export function MarcarDia({ socioId, dia, hecho }: { socioId: string; dia: number; hecho: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const tocar = (deshacer: boolean) => empezar(async () => { const r = await marcarDiaHecho(socioId, dia, deshacer); setError(r.error ?? null); });
  return (
    <div className="space-y-2" data-marcar-dia={hecho ? "hecho" : "pendiente"}>
      {hecho ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="pildora pildora-verde text-base" role="status" data-dia-hecho>✅ Día {dia} hecho hoy. ¡Buen laburo!</p>
          <button type="button" className="boton-texto texto-suave" disabled={ocupado} onClick={() => tocar(true)}>Deshacer</button>
        </div>
      ) : (
        <button type="button" className="boton boton-principal w-full sm:w-auto text-lg" disabled={ocupado} data-hice-dia onClick={() => tocar(false)}>{ocupado ? "Guardando…" : `✅ Hice el Día ${dia}`}</button>
      )}
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal">⚠️ {error}</p>}
    </div>
  );
}
