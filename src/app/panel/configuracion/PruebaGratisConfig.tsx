"use client";
import { useEffect, useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarPruebaGratis, leerPruebaGratis, type ModoPrueba } from "./acciones";

const OPCIONES: [ModoPrueba, string, string][] = [
  ["no", "No", "No se da prueba gratis. La clase de prueba de la página solo deja tus datos para que te escriba el gimnasio."],
  ["dia", "1 día", "Quien nunca fue socio entra gratis un día (el día que la recepción se la da o el de la clase que reservó en la página). Una vez por DNI."],
  ["clase", "1 clase", "Quien nunca fue socio entra gratis a una clase (desde 1 hora antes hasta que termina). Una vez por DNI."],
];

/** VD-51: la prueba gratis. Arranca apagada; la prende solo el dueño (regala entradas). Guarda al tocar. */
export function PruebaGratisConfig({ puedeEditar }: { puedeEditar: boolean }) {
  const [modo, setModo] = useState<ModoPrueba | null>(null);
  const [estado, setEstado] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  useEffect(() => {
    let vivo = true;
    void leerPruebaGratis().then((r) => { if (!vivo) return; if (r.modo) setModo(r.modo); else setEstado({ error: r.error ?? "No se pudo leer." }); });
    return () => { vivo = false; };
  }, []);
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-3" data-prueba-gratis={modo ?? "cargando"}>
      <p className="titulo text-2xl">🎁 Prueba gratis</p>
      <p className="texto-suave">Para sumar socios nuevos: una vez por DNI, la da la recepción desde la Entrada o la reserva el interesado desde tu página (“Probá una clase”). Entra como una entrada más, pero no cuenta como socio ni gasta nada de ningún plan.</p>
      {modo === null && !estado.error ? <div className="esqueleto h-16" aria-hidden /> : modo !== null && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Prueba gratis">
            {OPCIONES.map(([k, t]) => (
              <button key={k} type="button" aria-pressed={modo === k} data-prueba-opcion={k} disabled={!puedeEditar || ocupado}
                className={`pestana ${modo === k ? "!bg-[var(--texto)] !text-[var(--fondo)]" : ""}`}
                onClick={() => {
                  setEstado({});
                  empezar(async () => {
                    const r = await guardarPruebaGratis(k);
                    if (r.error || !r.modo) setEstado({ error: r.error ?? "No se pudo guardar." });
                    else { setModo(r.modo); setEstado({ ok: "Guardado." }); }
                  });
                }}>{t}</button>
            ))}
          </div>
          <p className="texto-tenue text-sm">{OPCIONES.find(([k]) => k === modo)?.[2]}</p>
        </>
      )}
      {!puedeEditar && <p className="texto-tenue text-sm">La prende el dueño.</p>}
      {estado.error && <Mensaje tipo="error">{estado.error}</Mensaje>}
      {estado.ok && <Mensaje tipo="exito">{estado.ok}</Mensaje>}
    </section>
  );
}
