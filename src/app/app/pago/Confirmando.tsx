"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { estadoPagoOnline } from "../acciones";
import { Icono } from "@/components/ui/Icono";

/** Vuelve de MercadoPago: se pregunta cada 3 segundos hasta que el aviso de MercadoPago lo confirma. */
export function Confirmando({ pagoId, inicial, volver }: { pagoId: string; inicial: string; volver: string }) {
  const [estado, setEstado] = useState(inicial);
  const [motivo, setMotivo] = useState<string | null>(null);
  const [vueltas, setVueltas] = useState(0);
  useEffect(() => {
    if (estado !== "pendiente" || vueltas > 100) return;   // aprobado, rechazado y devuelto son finales
    const t = setTimeout(async () => {
      const r = await estadoPagoOnline(pagoId);
      if (r.estado) setEstado(r.estado);
      if (r.motivo) setMotivo(r.motivo);
      setVueltas((v) => v + 1);
    }, 3000);
    return () => clearTimeout(t);
  }, [estado, vueltas, pagoId]);
  if (estado === "aprobado") {
    return (
      <div className="space-y-4" data-pago="aprobado">
        <p className="text-6xl" aria-hidden><Icono nombre="ok" /></p>
        <h1 className="titular text-5xl">¡Pago acreditado!</h1>
        <p className="texto-suave text-lg">Ya quedaste al día.</p>
        <Link href={volver} className="boton boton-principal w-full text-lg">Volver a mi gimnasio</Link>
      </div>
    );
  }
  if (estado === "devuelto") {
    return (
      <div className="space-y-4" data-pago="devuelto">
        <p className="text-6xl" aria-hidden><Icono nombre="deshacer" /></p>
        <h1 className="titular text-5xl">Este pago se devolvió</h1>
        <p className="texto-suave text-lg">MercadoPago devolvió la plata, así que la cuota ya no está paga. Si fue un error, pagá de nuevo o hablá con el gimnasio.</p>
        <Link href={volver} className="boton boton-principal w-full text-lg">Volver a mi gimnasio</Link>
      </div>
    );
  }
  if (estado === "rechazado") {
    return (
      <div className="space-y-4" data-pago="rechazado">
        <p className="text-6xl" aria-hidden><Icono nombre="recibo" /></p>
        <h1 className="titular text-5xl">No se pudo cobrar</h1>
        <p className="texto-suave text-lg">{motivo ?? "MercadoPago no aprobó el pago."} Podés probar de nuevo con otro medio.</p>
        <Link href={volver} className="boton boton-principal w-full text-lg">Volver y probar de nuevo</Link>
      </div>
    );
  }
  return (
    <div className="space-y-4" data-pago="pendiente" aria-live="polite">
      <p className="text-6xl animate-pulse" aria-hidden><Icono nombre="reloj-arena" /></p>
      <h1 className="titular text-5xl">Estamos confirmando tu pago…</h1>
      <p className="texto-suave text-lg">MercadoPago nos avisa en unos segundos. Esta pantalla se actualiza sola.</p>
      {vueltas > 100 && <p className="pildora">Tarda más de lo normal: si ya pagaste, quedás al día apenas llegue el aviso. Podés cerrar esta pantalla.</p>}
      <Link href={volver} className="boton w-full">Volver a mi gimnasio</Link>
    </div>
  );
}
