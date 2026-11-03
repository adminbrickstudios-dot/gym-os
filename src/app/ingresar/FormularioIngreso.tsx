"use client";
import { useActionState, useEffect } from "react";
import { ingresar, type EstadoIngreso } from "./acciones";

export function FormularioIngreso({ siguiente }: { siguiente: string | null }) {
  const [estado, accion, enviando] = useActionState<EstadoIngreso, FormData>(ingresar, {});
  useEffect(() => { if (estado.destino) window.location.assign(estado.destino); }, [estado.destino]);
  const yendo = enviando || !!estado.destino;
  return (
    <form action={accion} className="mt-10 space-y-4">
      {siguiente && <input type="hidden" name="siguiente" value={siguiente} />}
      <label className="block space-y-2">
        <span className="etiqueta">Mail</span>
        <input className="campo" type="email" name="email" autoComplete="email" required defaultValue={estado.email} placeholder="vos@ejemplo.com" />
      </label>
      <label className="block space-y-2">
        <span className="etiqueta">Contraseña</span>
        <input className="campo" type="password" name="contrasena" autoComplete="current-password" required />
      </label>
      {estado.error && (
        <p role="alert" className="pildora pildora-rojo !rounded-2xl !px-4 !py-3 w-full">⚠️ {estado.error}</p>
      )}
      <button type="submit" disabled={yendo} className="boton boton-principal text-lg w-full !mt-6">
        {yendo ? "Entrando…" : "🔑 Entrar"}
      </button>
      <p className="texto-tenue text-sm text-center">
        ¿Te olvidaste la contraseña? Pedile una nueva al dueño de tu gimnasio (si sos el dueño, a BRIK).
      </p>
    </form>
  );
}
