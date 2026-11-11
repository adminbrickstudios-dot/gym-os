"use client";
import { useEffect, useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarEsperaPlazo, leerEsperaPlazo } from "./acciones";

const OPCIONES: [number | null, string][] = [[null, "Sin plazo"], [30, "30 minutos"], [60, "1 hora"], [180, "3 horas"], [720, "12 horas"]];

/** FA-23: cuando se libera un lugar en una clase llena, el primero de la lista de espera tiene este plazo para aceptarlo; si no acepta, pasa al siguiente. Sin plazo, el lugar sube solo. */
export function EsperaPlazo({ puedeEditar }: { puedeEditar: boolean }) {
  const [minutos, setMinutos] = useState<number | null | undefined>(undefined);
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  useEffect(() => {
    let vivo = true;
    void leerEsperaPlazo().then((r) => { if (!vivo) return; if (r.error) setMsj({ error: r.error }); else setMinutos(r.minutos ?? null); });
    return () => { vivo = false; };
  }, []);
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-3" data-espera-plazo={minutos === undefined ? "cargando" : minutos === null ? "sin" : String(minutos)}>
      <p className="titulo text-2xl">Lista de espera: plazo para aceptar</p>
      <p className="texto-suave">Cuando alguien cancela en una clase llena, el primero de la espera recibe el lugar y tiene este plazo para aceptarlo. Si no responde a tiempo, pasa al siguiente. Se calcula al consultar: no hace falta ningún proceso automático.</p>
      {minutos === undefined && !msj.error ? <div className="esqueleto h-11" aria-hidden /> : minutos !== undefined && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Plazo para aceptar el lugar">
          {OPCIONES.map(([m, t]) => (
            <button key={String(m)} type="button" aria-pressed={minutos === m} data-espera-opcion={m ?? "sin"} disabled={!puedeEditar || ocupado}
              className={`pestana ${minutos === m ? "!bg-[var(--texto)] !text-[var(--fondo)]" : ""}`}
              onClick={() => { setMsj({}); empezar(async () => {
                const r = await guardarEsperaPlazo(m);
                if (r.error) setMsj({ error: r.error }); else { setMinutos(m); setMsj({ ok: m === null ? "Listo: el lugar sube solo, sin plazo." : `Listo: ${t} para aceptar.` }); }
              }); }}>{t}</button>
          ))}
        </div>
      )}
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
      {msj.ok && !msj.error && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
    </section>
  );
}
