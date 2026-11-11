"use client";
import { useEffect, useState, useTransition } from "react";
import { Interruptor } from "@/components/ui/Interruptor";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarAutonomiaSocios, leerAutonomiaSocios, type AutonomiaSocios as Estado } from "./autonomia-acciones";

/** F7.1: la pausa que se aprueba sola y la ocupación en vivo para los socios. Las dos vienen apagadas; las prende solo el dueño. */
export function AutonomiaSocios({ puedeEditar }: { puedeEditar: boolean }) {
  const [e, setE] = useState<Estado | null>(null);
  const [dias, setDias] = useState("14");
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  useEffect(() => {
    let vivo = true;
    void leerAutonomiaSocios().then((r) => { if (!vivo) return; if (r.estado) { setE(r.estado); setDias(String(r.estado.pausa_auto_max_dias)); } else setMsj({ error: r.error }); });
    return () => { vivo = false; };
  }, []);
  const guardar = (pausa: boolean, ocup: boolean) => empezar(async () => {
    setMsj({});
    const n = Number(dias);
    const r = await guardarAutonomiaSocios(pausa, Number.isFinite(n) ? n : 14, ocup);
    if (r.error || !r.estado) { setMsj({ error: r.error ?? "No se pudo guardar" }); return; }
    setE(r.estado); setDias(String(r.estado.pausa_auto_max_dias)); setMsj({ ok: "Guardado." });
  });
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-3" data-autonomia-socios={e ? "listo" : "cargando"}>
      <p className="titulo text-2xl">Pausa solo y ocupación en vivo</p>
      {!e && !msj.error ? <div className="esqueleto h-24" aria-hidden /> : e && (
        <>
          <Interruptor etiqueta="El socio pausa su plan y se aprueba solo" checked={e.pausa_autoaprobar} disabled={!puedeEditar || ocupado} data-pausa-auto
            ayuda={`Si el pedido entra en el tope de ${e.pausa_dias_por_anio} días por año de Reglas y dura hasta los días de abajo, queda aprobado en el momento y la membresía se corre. Si no, lo ves vos como siempre. Apagado: todos los pedidos los aprobás vos.`}
            onChange={(ev) => guardar(ev.target.checked, e.ocupacion_visible_socios)} />
          <label className="flex items-center gap-3 flex-wrap">
            <span className="texto-suave">Máximo de días que se aprueban solos</span>
            <input className="campo w-24" type="number" min={1} max={90} value={dias} disabled={!puedeEditar || ocupado} data-pausa-auto-dias
              onChange={(ev) => setDias(ev.target.value)} onBlur={() => { if (Number(dias) !== e.pausa_auto_max_dias) guardar(e.pausa_autoaprobar, e.ocupacion_visible_socios); }} />
          </label>
          <Interruptor etiqueta="Los socios ven cuánta gente hay en el gimnasio" checked={e.ocupacion_visible_socios} disabled={!puedeEditar || ocupado} data-ocupacion-visible
            ayuda="En su app aparece 'Ahora hay N personas'. Solo un número, nunca quién. Apagado por defecto."
            onChange={(ev) => guardar(e.pausa_autoaprobar, ev.target.checked)} />
        </>
      )}
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
      {msj.ok && !msj.error && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
    </section>
  );
}
