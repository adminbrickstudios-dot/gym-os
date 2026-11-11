"use client";
import { useState, useTransition } from "react";
import { probarMercadoPago } from "../configuracion/acciones";
import { Icono } from "@/components/ui/Icono";

/** BASE-7: "Probar conexión" de MercadoPago sin salir del asistente. Usa el token ya guardado; nunca vuelve al navegador. */
export function ProbarMp({ conectado }: { conectado: boolean }) {
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  if (!conectado) return <p className="texto-tenue text-sm mt-2" data-asistente-mp="no">MercadoPago todavía no está conectado: se conecta en Cómo cobrás.</p>;
  const probar = () => empezar(async () => {
    const r = await probarMercadoPago();
    setMsj(r.error ? { error: r.error } : { ok: `La conexión funciona: es la cuenta de ${r.cuenta}.` });
  });
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3" data-asistente-mp="conectado">
      <button type="button" className="boton" disabled={ocupado} onClick={probar} data-asistente-probar-mp><Icono nombre="enlace" /> {ocupado ? "Probando…" : "Probar conexión"}</button>
      {msj.ok && <p role="status" className="pildora pildora-verde whitespace-normal"><Icono nombre="ok" /> {msj.ok}</p>}
      {msj.error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {msj.error}</p>}
    </div>
  );
}
