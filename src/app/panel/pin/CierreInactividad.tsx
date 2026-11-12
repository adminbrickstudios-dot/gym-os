"use client";
// C6 · Cierre por inactividad de la compu compartida. Si nadie toca nada el tiempo que puso el gimnasio (Configuración → Entrada),
// primero suelta a quien atiende (vuelve a pedir el PIN) y, si ya no había nadie, cierra la sesión del gimnasio.
// La actividad se comparte entre pestañas (localStorage): una pestaña quieta no cierra la sesión de quien trabaja en otra.
import { useEffect, useRef, useState } from "react";
import { cerrarPorInactividad } from "./acciones";
import { CLAVE_ACTIVIDAD, guardarCompuCompartida, limiteInactividadMs } from "@/app/panel/entrada/compartida";
import { Icono } from "@/components/ui/Icono";

const EVENTOS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"] as const;

export function CierreInactividad({ minutos }: { minutos: number }) {
  const [segundos, setSegundos] = useState<number | null>(null);   // los segundos que faltan, solo en el último tramo
  const yendo = useRef(false);

  useEffect(() => {
    const limite = limiteInactividadMs(minutos);
    if (!limite) return;
    let ultimo = Date.now();
    const anotar = () => {
      const ahora = Date.now();
      if (ahora - ultimo < 500) return;   // no escribir en el almacenamiento en cada movimiento del mouse
      ultimo = ahora;
      try { localStorage.setItem(CLAVE_ACTIVIDAD, String(ahora)); } catch { /* sin almacenamiento: vale esta pestaña sola */ }
    };
    const ultimaDeTodas = () => {
      try { return Math.max(ultimo, Number(localStorage.getItem(CLAVE_ACTIVIDAD)) || 0); } catch { return ultimo; }
    };
    const aviso = Math.min(30_000, Math.floor(limite / 2));
    const mirar = () => {
      if (yendo.current) return;
      const quieto = Date.now() - ultimaDeTodas();
      if (quieto >= limite) {
        yendo.current = true;
        void cerrarPorInactividad().then((r) => {
          if (r.cerroSesion) guardarCompuCompartida(true);   // si la sesión se cerró sola, esta compu es compartida: que el ingreso no guarde la contraseña
          window.location.assign(r.ir);
        }).catch(() => { yendo.current = false; });
      } else setSegundos(limite - quieto <= aviso ? Math.max(1, Math.ceil((limite - quieto) / 1000)) : null);
    };
    for (const e of EVENTOS) window.addEventListener(e, anotar, { passive: true, capture: true });
    const id = setInterval(mirar, Math.min(1000, Math.max(200, Math.floor(limite / 10))));
    anotar();
    return () => { for (const e of EVENTOS) window.removeEventListener(e, anotar, { capture: true }); clearInterval(id); };
  }, [minutos]);

  if (segundos === null) return null;
  return (
    <p role="alert" data-cierre-inactividad={segundos} className="pildora pildora-amarillo whitespace-normal fixed bottom-4 left-4 z-50 !text-base">
      <Icono nombre="reloj" /> Por falta de uso, se cierra en {segundos} s. Tocá cualquier tecla para seguir.
    </p>
  );
}
