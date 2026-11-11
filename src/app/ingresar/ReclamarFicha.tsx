"use client";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { reclamarFicha, type EstadoReclamo } from "./reclamar";
import { Mensaje } from "@/components/ui/Mensaje";
import { Icono } from "@/components/ui/Icono";
import { CampoAntiRobot } from "@/components/cuentas/CampoAntiRobot";

/** "Es mi primera vez": el socio que ya estaba cargado crea su contraseña con su DNI y su celular. */
export function ReclamarFicha() {
  const [e, accion, enviando] = useActionState<EstadoReclamo, FormData>(reclamarFicha, {});
  useEffect(() => { if (e.destino) window.location.assign(e.destino); }, [e.destino]);
  const yendo = enviando || !!e.destino;
  const v = (c: string) => e.datos?.[c] ?? "";
  return (
    <form action={accion} className="mt-6 space-y-4" data-reclamar-form>
      <label className="block space-y-2">
        <span className="etiqueta">Tu DNI</span>
        <input className="campo" name="dni" required inputMode="numeric" pattern="[0-9]{7,8}" maxLength={8} autoComplete="off" defaultValue={v("dni")}
          onInput={(ev) => { ev.currentTarget.value = ev.currentTarget.value.replace(/\D/g, "").slice(0, 8); }} />
      </label>
      <label className="block space-y-2">
        <span className="etiqueta">Tu celular</span>
        <input className="campo" name="telefono" type="tel" required autoComplete="tel" placeholder="387 555 1234" defaultValue={v("telefono")} />
        <span className="block text-sm texto-tenue">El que tiene cargado el gimnasio.</span>
      </label>
      <label className="block space-y-2">
        <span className="etiqueta">Tu mail</span>
        <input className="campo" name="email" type="email" required autoComplete="email" defaultValue={v("email")} />
      </label>
      <label className="block space-y-2">
        <span className="etiqueta">Elegí una contraseña</span>
        <input className="campo" name="contrasena" type="password" required minLength={8} autoComplete="new-password" />
        <span className="block text-sm texto-tenue">8 letras o más.</span>
      </label>
      <CampoAntiRobot />
      {e.error && <Mensaje tipo="error">{e.error}</Mensaje>}
      <button type="submit" disabled={yendo} className="boton boton-principal text-lg w-full">{yendo ? "Entrando…" : <><Icono nombre="persona" /> Reclamar mi ficha</>}</button>
      <p className="text-center text-sm"><Link href="/ingresar?modo=socio" className="underline underline-offset-4 inline-flex items-center min-h-11">Ya tengo contraseña, entrar</Link></p>
    </form>
  );
}
