"use client";
import { useEffect, useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarAvisarSinBloquear, leerAvisarSinBloquear } from "./acciones";

const OPCIONES: [number, string][] = [[0, "No"], [7, "7 días"], [14, "14 días"], [30, "30 días"]];
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "numeric", year: "numeric" });

/** FA-7: los primeros días del gimnasio, la entrada avisa pero no frena. Para cuando se están cargando los socios y los cobros. Lo cambia solo el dueño. */
export function AvisarSinBloquear({ puedeEditar }: { puedeEditar: boolean }) {
  const [hasta, setHasta] = useState<string | null | undefined>(undefined);
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  useEffect(() => {
    let vivo = true;
    void leerAvisarSinBloquear().then((r) => { if (!vivo) return; if (r.error) setMsj({ error: r.error }); else setHasta(r.activo ? r.hasta ?? null : null); });
    return () => { vivo = false; };
  }, []);
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-3" data-avisar-sin-bloquear={hasta === undefined ? "cargando" : hasta ? "si" : "no"}>
      <p className="titulo text-2xl">Primeros días: avisar sin frenar</p>
      <p className="texto-suave">Mientras cargás tus socios y tus cobros, la entrada muestra el aviso pero deja pasar a todos. Pasado el plazo vuelve a la regla normal sola, sin que tengas que acordarte.</p>
      {hasta === undefined && !msj.error ? <div className="esqueleto h-11" aria-hidden /> : hasta !== undefined && (
        <>
          <p className="font-semibold">{hasta ? `Prendido hasta el ${fecha(hasta)}` : "Apagado: la entrada frena a quien no puede pasar"}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Días de aviso sin frenar">
            {OPCIONES.map(([d, t]) => (
              <button key={d} type="button" data-sin-bloquear-dias={d} disabled={!puedeEditar || ocupado} className="pestana"
                onClick={() => { setMsj({}); empezar(async () => {
                  const r = await guardarAvisarSinBloquear(d);
                  if (r.error) setMsj({ error: r.error }); else { setHasta(r.activo ? r.hasta ?? null : null); setMsj({ ok: d ? `Listo: la entrada avisa sin frenar por ${d} días.` : "Listo: la entrada vuelve a frenar." }); }
                }); }}>{t}</button>
            ))}
          </div>
        </>
      )}
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
      {msj.ok && !msj.error && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
    </section>
  );
}
