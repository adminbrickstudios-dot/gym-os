"use client";
import { useState } from "react";

/**
 * Entrar al panel de un gimnasio como Soporte BRIK (POST: la base valida y lo suma al equipo).
 * VD-40: pide el MOTIVO; queda escrito (quién, por qué, cuándo) y el dueño lo ve en su Control.
 */
export function BotonEntrar({ gimnasioId, principal = true, texto = "🚪 Entrar al panel", motivoInicial = "" }: {
  gimnasioId: string; principal?: boolean; texto?: string; motivoInicial?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return <button type="button" className={`boton ${principal ? "boton-principal" : ""}`} onClick={() => setAbierto(true)} data-entrar-soporte>{texto}</button>;
  }
  return (
    <form action="/admin/entrar" method="post" className="tarjeta p-3 flex flex-wrap items-end gap-2 w-full sm:w-auto" data-motivo-soporte>
      <input type="hidden" name="gimnasio_id" value={gimnasioId} />
      <label className="space-y-1 flex-1 min-w-[14rem]">
        <span className="etiqueta">¿Para qué entrás? El dueño lo va a ver</span>
        <input name="motivo" required minLength={5} maxLength={300} autoFocus defaultValue={motivoInicial} className="campo" placeholder="Me pidió ayuda con los planes" />
      </label>
      <button className={`boton ${principal ? "boton-principal" : ""}`}>Entrar como soporte</button>
      <button type="button" className="boton texto-suave" onClick={() => setAbierto(false)}>Cancelar</button>
    </form>
  );
}
