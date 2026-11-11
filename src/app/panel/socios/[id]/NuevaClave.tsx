"use client";
import { useState, useTransition } from "react";
import { ContrasenaNueva } from "@/components/cuentas/AccesoPersona";
import { Icono } from "@/components/ui/Icono";
import type { ResultadoClave } from "@/lib/cuentas-clave";
import { nuevaClaveSocio } from "../clave-acciones";

/**
 * C1 · "Nueva clave" a un toque, sin mails. La base decide si puede (dueño o recepción); si no, el error se muestra, nunca se calla.
 * Sin cuenta todavía, la crea con su mail. La clave se muestra una sola vez, con Copiar y el mensaje armado para WhatsApp.
 */
export function NuevaClave({ socioId, nombre, telefono, tieneEmail }: { socioId: string; nombre: string; telefono: string | null; tieneEmail: boolean }) {
  const [r, setR] = useState<ResultadoClave | null>(null);
  const [ocupado, empezar] = useTransition();
  const pedir = () => {
    if (!confirm(`¿Darle a ${nombre} una clave nueva? Si ya tenía una, deja de servir.`)) return;
    empezar(async () => { setR(await nuevaClaveSocio(socioId)); });
  };
  return (
    <div className="space-y-2" data-nueva-clave>
      {!r?.contrasena && (
        <button type="button" className="boton boton-chico" disabled={ocupado} onClick={pedir}>
          <Icono nombre="llave" /> {ocupado ? "Generando…" : "Nueva clave"}
        </button>
      )}
      {!r && !tieneEmail && <p className="texto-suave text-sm">Si no tiene cuenta, se crea con su mail: cargalo en Editar primero.</p>}
      {r && <ContrasenaNueva r={r} telefono={telefono} onListo={() => setR(null)} />}
    </div>
  );
}
