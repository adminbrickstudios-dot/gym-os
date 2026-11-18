"use client";
// VD-46M · El cartel rojo "EMERGENCIA activa" de la Entrada (la página y la ventana). Lo que dice sale de la base:
// acá solo se pregunta cada 60 segundos mientras la pantalla está a la vista.
import { useEffect, useState } from "react";
import { estadoEmergencia } from "@/app/panel/entrada/emergencia-acciones";
import type { EmergenciaActiva } from "@/app/panel/entrada/emergencia-tipos";
import { colorVar } from "./Estado";
import { Icono } from "@/components/ui/Icono";

/** La emergencia activa de la sede (o null). `inicial` evita el parpadeo cuando la página ya la trae. */
export function useEmergencia(sedeId: string, activo = true, inicial: EmergenciaActiva | null = null, leida = false) {
  const [e, setE] = useState<EmergenciaActiva | null>(inicial);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    const leer = () => void estadoEmergencia(sedeId).then((r) => { if (vivo && !r.error) setE(r.e?.activa ?? null); });
    if (!leida) leer();   // Cacería (18/11): si la página ya la leyó (en su lote), no se vuelve a preguntar al abrir
    // Cacería (16/11): con la pestaña escondida no se pregunta; al volver se lee de nuevo.
    const siVisible = () => { if (document.visibilityState === "visible") leer(); };
    const i = setInterval(siVisible, 60000);   // Cacería (18/11): un único respaldo cada 60 s (antes 30 s)
    document.addEventListener("visibilitychange", siVisible);
    return () => { vivo = false; clearInterval(i); document.removeEventListener("visibilitychange", siVisible); };
  }, [sedeId, activo, leida]);
  return e;
}

const hora = (m: string) => new Date(m).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function CartelEmergencia({ e }: { e: EmergenciaActiva | null }) {
  if (!e) return null;
  return (
    <div role="alert" data-emergencia-activa className="aparecer rounded-[var(--radio-grande)] p-4 flex items-start gap-3 border-2"
      style={{ background: `color-mix(in oklab, ${colorVar("rojo")}, var(--fondo) 80%)`, borderColor: colorVar("rojo") }}>
      <span className="text-3xl" aria-hidden><Icono nombre="alerta-circulo" /></span>
      <div className="min-w-0">
        <p className="titulo text-xl">EMERGENCIA activa en la puerta</p>
        <p className="break-words">{e.motivo} · hasta las {hora(e.vence_en)}. Entran todos; cada entrada queda marcada.</p>
      </div>
    </div>
  );
}
