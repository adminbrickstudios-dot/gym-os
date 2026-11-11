"use client";
import { useEffect, useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarReglaCierres, leerReglaCierres } from "./acciones";
import { Icono } from "@/components/ui/Icono";

const OPCIONES: [boolean, string, string][] = [
  [false, "No suma días", "Un feriado o unas vacaciones no mueven el vencimiento de nadie. Es lo normal y lo que queda si no elegís."],
  [true, "Suma los días cerrados", "A quienes estaban cubiertos esos días se les corre el vencimiento por la cantidad de días que estuvo cerrado. Se avisa a cuántos antes de cargar el cierre."],
];

/** VD-57: si los días en que el gimnasio cierra se suman al vencimiento. Una regla del gimnasio, no del que carga el cierre. La cambia solo el dueño. */
export function ReglaCierres({ puedeEditar }: { puedeEditar: boolean }) {
  const [suma, setSuma] = useState<boolean | null>(null);
  const [estado, setEstado] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  useEffect(() => {
    let vivo = true;
    void leerReglaCierres().then((r) => { if (!vivo) return; if (r.suma !== undefined) setSuma(r.suma); else setEstado({ error: r.error ?? "No se pudo leer." }); });
    return () => { vivo = false; };
  }, []);
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-3" data-regla-cierres={suma === null ? "cargando" : suma ? "suma" : "no-suma"}>
      <p className="titulo text-2xl"><Icono nombre="prohibido" /> Días cerrados</p>
      <p className="texto-suave">Cuando cargás un cierre (feriado, vacaciones, mantenimiento), ¿esos días se suman al vencimiento de los socios? Lo decide esta regla, igual para todos: ya no depende de quién cargue el cierre.</p>
      {suma === null && !estado.error ? <div className="esqueleto h-16" aria-hidden /> : suma !== null && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Días cerrados">
            {OPCIONES.map(([v, t]) => (
              <button key={String(v)} type="button" aria-pressed={suma === v} data-regla-opcion={v ? "suma" : "no-suma"} disabled={!puedeEditar || ocupado}
                className={`pestana ${suma === v ? "!bg-[var(--texto)] !text-[var(--fondo)]" : ""}`}
                onClick={() => {
                  setEstado({});
                  empezar(async () => {
                    const r = await guardarReglaCierres(v);
                    if (r.error || r.suma === undefined) setEstado({ error: r.error ?? "No se pudo guardar." });
                    else { setSuma(r.suma); setEstado({ ok: "Guardado. Vale para los cierres que cargues de ahora en más; los ya cargados quedan como estaban." }); }
                  });
                }}>{t}</button>
            ))}
          </div>
          <p className="texto-tenue text-sm">{OPCIONES.find(([v]) => v === suma)?.[2]}</p>
        </>
      )}
      {!puedeEditar && <p className="texto-tenue text-sm">La cambia el dueño.</p>}
      {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
      {estado.ok && <Mensaje tipo="exito">{estado.ok}</Mensaje>}
    </section>
  );
}
