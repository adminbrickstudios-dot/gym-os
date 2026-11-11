"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cerrarOtrasSesiones } from "@/lib/cuenta/acciones";
import { nombreDispositivo, type SesionAbierta } from "@/lib/cuenta/dispositivo";
import { Mensaje } from "@/components/ui/Mensaje";
import { Icono } from "@/components/ui/Icono";

const cuando = (iso: string, zona?: string) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

/** VD-33b: dónde está abierta mi cuenta, y un botón para cerrar todas menos esta. */
export function Sesiones({ sesiones, zona }: { sesiones: SesionAbierta[]; zona?: string }) {
  const router = useRouter();
  const [ocupado, empezar] = useTransition();
  const [msj, setMsj] = useState<{ ok?: boolean; texto?: string }>({});
  const otras = sesiones.filter((s) => !s.actual).length;
  return (
    <section className="tarjeta p-5 sm:p-6 max-w-xl mt-6 space-y-3" aria-labelledby="mis-sesiones" data-sesiones={sesiones.length}>
      <h2 id="mis-sesiones" className="titulo text-2xl"><Icono nombre="celular" /> Dónde tenés abierta tu cuenta</h2>
      <ul className="space-y-2">
        {sesiones.map((s) => (
          <li key={s.id} data-sesion={s.actual ? "actual" : "otra"} className="flex items-center gap-3 min-h-12">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold truncate">{nombreDispositivo(s.user_agent)}</span>
              <span className="block texto-suave text-sm">Última actividad {cuando(s.actividad, zona)}</span>
            </span>
            {s.actual && <span className="pildora pildora-verde">Este dispositivo</span>}
          </li>
        ))}
      </ul>
      {otras === 0 ? (
        <p className="texto-suave" data-sin-otras>Solo está abierta en este dispositivo. <Icono nombre="estrella" /></p>
      ) : (
        <button type="button" className="boton" disabled={ocupado} data-cerrar-otras
          onClick={() => empezar(async () => {
            const r = await cerrarOtrasSesiones();
            if (r.error) { setMsj({ texto: r.error }); return; }
            setMsj({ ok: true, texto: "Listo: cerramos las demás sesiones." });
            router.refresh();
          })}>
          {ocupado ? "Cerrando…" : `Cerrar ${otras === 1 ? "la otra sesión" : `las otras ${otras} sesiones`}`}
        </button>
      )}
      {msj.texto && <Mensaje tipo={msj.ok ? "exito" : "error"}>{msj.texto}</Mensaje>}
    </section>
  );
}
