"use client";
// VD-19: "Anotarme" en un evento desde la página. Nombre, DNI (para el check-in) y WhatsApp; se paga en recepción.
import { useActionState, useState } from "react";
import { formatearPesos } from "@/lib/formato";
import { anotarseEvento, type EstadoAnotarse } from "./acciones";
import { Icono } from "@/components/ui/Icono";
import { CampoAntiRobot } from "@/components/cuentas/CampoAntiRobot";

export function AnotarseEvento({ eventoId, lleno, conEspera }: { eventoId: string; lleno: boolean; conEspera: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, enviando] = useActionState<EstadoAnotarse, FormData>(anotarseEvento.bind(null, eventoId), {});
  if (estado.ok) {
    return (
      <p className="mensaje mensaje-exito" role="status" data-anotado-pagina={estado.estado}>
        {estado.estado === "espera" ? `Quedaste en la lista de espera (lugar ${estado.posicion}). Si se libera un lugar, te escribimos.` : `¡Listo, estás anotado!${estado.precio ? ` Se paga en recepción (${formatearPesos(estado.precio)}).` : ""}`}
      </p>
    );
  }
  if (lleno && !conEspera) return null;
  if (!abierto) return <button type="button" className="boton boton-principal mt-2" data-abrir-anotarse onClick={() => setAbierto(true)}>{lleno ? "Anotarme en la lista de espera" : "Anotarme"}</button>;
  return (
    <form action={accion} className="space-y-3 pt-2" data-form-anotarse>
      <label className="block space-y-1"><span className="etiqueta">Tu nombre y apellido</span>
        <input name="nombre" required maxLength={80} autoComplete="name" className="campo" defaultValue={estado.datos?.nombre} /></label>
      <label className="block space-y-1"><span className="etiqueta">Tu DNI</span>
        <input name="dni" required inputMode="numeric" autoComplete="off" placeholder="Sin puntos" className="campo" defaultValue={estado.datos?.dni} /></label>
      <label className="block space-y-1"><span className="etiqueta">Tu WhatsApp</span>
        <input name="telefono" required type="tel" inputMode="tel" autoComplete="tel" placeholder="387 555 1234" className="campo" defaultValue={estado.datos?.telefono} /></label>
      <CampoAntiRobot />
      {estado.error && <p role="alert" className="mensaje mensaje-error"><Icono nombre="alerta" /> {estado.error}</p>}
      <button type="submit" disabled={enviando} className="boton boton-principal w-full sm:w-auto px-8">{enviando ? "Anotando…" : "Confirmar"}</button>
    </form>
  );
}
