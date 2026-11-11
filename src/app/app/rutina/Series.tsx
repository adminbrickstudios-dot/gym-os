"use client";
import { useOptimistic, useState, useTransition } from "react";
import { marcarSerie } from "./acciones";
import { Icono } from "@/components/ui/Icono";

/** FA-15: una casilla por serie ("1 2 3 4"); tocar la marca como hecha y volver a tocar la desmarca. Se ve al instante y la base confirma. */
export function Series({ socioId, dia, ejercicioId, series, hechas }: { socioId: string; dia: number; ejercicioId: string; series: number; hechas: number[] }) {
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();
  const [vistas, cambiar] = useOptimistic(hechas, (actuales, [n, hecha]: [number, boolean]) => (hecha ? [...new Set([...actuales, n])] : actuales.filter((x) => x !== n)));
  const tocar = (n: number) => {
    const hecha = !vistas.includes(n);
    empezar(async () => {
      cambiar([n, hecha]);
      const r = await marcarSerie(socioId, dia, ejercicioId, n, hecha);
      setError(r.error ?? null);
    });
  };
  return (
    <div className="w-full" data-series={`${vistas.length}/${series}`}>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Series hechas">
        {Array.from({ length: series }, (_, i) => i + 1).map((n) => {
          const hecha = vistas.includes(n);
          return (
            <button key={n} type="button" aria-pressed={hecha} aria-label={`Serie ${n}${hecha ? " hecha" : ""}`} data-serie={n} onClick={() => tocar(n)}
              className={`pildora cursor-pointer !min-h-11 !min-w-11 justify-center active:scale-95 ${hecha ? "pildora-verde" : ""}`}>{hecha ? <Icono nombre="ok" /> : n}</button>
          );
        })}
      </div>
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal mt-2"><Icono nombre="alerta" /> {error}</p>}
    </div>
  );
}
