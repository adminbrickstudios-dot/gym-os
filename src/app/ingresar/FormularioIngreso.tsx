"use client";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { ingresar, type EstadoIngreso } from "./acciones";
import { Mensaje } from "@/components/ui/Mensaje";

export function FormularioIngreso({ siguiente, emailInicial }: { siguiente: string | null; emailInicial?: string }) {
  const [estado, accion, enviando] = useActionState<EstadoIngreso, FormData>(ingresar, {});
  useEffect(() => { if (estado.destino) window.location.assign(estado.destino); }, [estado.destino]);
  const yendo = enviando || !!estado.destino;
  const recuperar = siguiente ? `/ingresar/recuperar?siguiente=${encodeURIComponent(siguiente)}` : "/ingresar/recuperar";
  return (
    <form action={accion} className="space-y-4">
      {siguiente && <input type="hidden" name="siguiente" value={siguiente} />}
      <label className="block space-y-2">
        <span className="etiqueta">Mail</span>
        <input className="campo" type="email" name="email" autoComplete="email" required defaultValue={estado.email ?? emailInicial} placeholder="vos@ejemplo.com" />
      </label>
      <label className="block space-y-2">
        <span className="etiqueta">Contraseña</span>
        <input className="campo" type="password" name="contrasena" autoComplete="current-password" required />
      </label>
      {estado.error && (
        <Mensaje tipo="error">{estado.error}{estado.ayuda && <> <a href={estado.ayuda} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 font-semibold" data-ayuda-brik>Escribinos por WhatsApp</a></>}</Mensaje>
      )}
      <button type="submit" disabled={yendo} className="boton boton-principal text-lg w-full !mt-6">
        {yendo ? "Entrando…" : "🔑 Entrar"}
      </button>
      <p className="text-sm text-center">
        <Link href={recuperar} className="underline underline-offset-4" data-olvide>¿Te olvidaste la contraseña?</Link>
      </p>
      <p className="texto-tenue text-sm text-center">
        {siguiente === "/app"
          ? "¿No tenés contraseña? Entrá con un código y creala en “Mi membresía”."
          : "Si no te llega el código, pedile una nueva al dueño de tu gimnasio (si sos el dueño, a BRIK)."}
      </p>
    </form>
  );
}
