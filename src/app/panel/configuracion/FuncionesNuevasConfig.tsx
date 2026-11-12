"use client";
import { useEffect, useState, useTransition } from "react";
import { Interruptor } from "@/components/ui/Interruptor";
import { Mensaje } from "@/components/ui/Mensaje";
import { FUNCIONES_NUEVAS } from "@/lib/panel/funciones-nuevas";
import { guardarFuncionNueva, leerFuncionesNuevas } from "./acciones";

/** F4/F5: funciones nuevas que arrancan apagadas. Cada gimnasio las prende cuando las quiere probar. */
export function FuncionesNuevasConfig({ puedeEditar }: { puedeEditar: boolean }) {
  const [prendidas, setPrendidas] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  useEffect(() => {
    let vivo = true;
    void leerFuncionesNuevas().then((r) => { if (!vivo) return; if (!r.prendidas) setError(r.error ?? "No se pudo leer."); else setPrendidas(r.prendidas); });
    return () => { vivo = false; };
  }, []);
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-3" data-funciones-nuevas={prendidas === null ? "cargando" : "listo"}>
      <p className="titulo text-2xl">Funciones nuevas</p>
      <p className="texto-suave">Arrancan apagadas. Prendé la que quieras probar; la podés apagar cuando quieras.</p>
      {prendidas === null && !error ? <div className="esqueleto h-12" aria-hidden /> : prendidas !== null && FUNCIONES_NUEVAS.map((f) => (
        <div key={f.clave} data-funcion-nueva={f.clave} data-prendida={prendidas.includes(f.clave) ? "si" : "no"}>
          <Interruptor etiqueta={f.titulo} ayuda={f.ayuda} checked={prendidas.includes(f.clave)} disabled={!puedeEditar || ocupado}
            onChange={(e) => {
              const si = e.target.checked; setError(null);
              empezar(async () => { const r = await guardarFuncionNueva(f.clave, si); if (!r.prendidas) setError(r.error ?? "No se pudo guardar."); else setPrendidas(r.prendidas); });
            }} />
        </div>
      ))}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </section>
  );
}
