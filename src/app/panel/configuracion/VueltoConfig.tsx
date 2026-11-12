"use client";
import { useEffect, useState, useTransition } from "react";
import { Interruptor } from "@/components/ui/Interruptor";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarVuelto, leerVuelto } from "./vuelto-acciones";

/** Vuelto en efectivo al cobrar. Apagado por defecto; lo prende solo el dueño. Solo muestra la cuenta: lo cobrado no cambia. */
export function VueltoConfig({ puedeEditar }: { puedeEditar: boolean }) {
  const [activo, setActivo] = useState<boolean | null>(null);
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  useEffect(() => {
    let vivo = true;
    void leerVuelto().then((r) => { if (!vivo) return; if (r.activo !== undefined) setActivo(r.activo); else setMsj({ error: r.error }); });
    return () => { vivo = false; };
  }, []);
  const guardar = (valor: boolean) => empezar(async () => {
    setMsj({});
    const r = await guardarVuelto(valor);
    if (r.error || r.activo === undefined) { setMsj({ error: r.error ?? "No se pudo guardar" }); return; }
    setActivo(r.activo); setMsj({ ok: "Guardado." });
  });
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-3" data-vuelto-config={activo === null ? "cargando" : "listo"}>
      <p className="titulo text-2xl">Vuelto en efectivo</p>
      {activo === null && !msj.error ? <div className="esqueleto h-12" aria-hidden /> : activo !== null && (
        <Interruptor etiqueta="Mostrar el vuelto al cobrar en efectivo" checked={activo} disabled={!puedeEditar || ocupado} data-vuelto-interruptor
          ayuda="Al cobrar en efectivo, la recepción escribe con cuánto paga el socio y ve el vuelto. Es solo una cuenta en pantalla: lo que se cobra y lo que entra a la caja es el total, no cambia. Apagado por defecto."
          onChange={(ev) => guardar(ev.target.checked)} />
      )}
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
      {msj.ok && !msj.error && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
    </section>
  );
}
