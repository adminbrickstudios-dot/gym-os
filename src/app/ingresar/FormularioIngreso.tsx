"use client";
import Link from "next/link";
import { useActionState, useEffect, useState, type CSSProperties } from "react";
import { ingresar, type EstadoIngreso } from "./acciones";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarCompuCompartida, leerCompuCompartida } from "@/app/panel/entrada/compartida";

export function FormularioIngreso({ siguiente, emailInicial }: { siguiente: string | null; emailInicial?: string }) {
  const [estado, accion, enviando] = useActionState<EstadoIngreso, FormData>(ingresar, {});
  useEffect(() => { if (estado.destino) window.location.assign(estado.destino); }, [estado.destino]);
  const yendo = enviando || !!estado.destino;
  // C6: en la compu compartida de la recepción el navegador no guarda ni rellena la contraseña (el campo no es de tipo contraseña,
  // que es lo que los navegadores ofrecen guardar, y se ve con puntos igual). Se recuerda por compu.
  const [compartida, setCompartida] = useState(false);
  const [porInactividad, setPorInactividad] = useState(false);
  useEffect(() => {
    setCompartida(leerCompuCompartida());
    setPorInactividad(new URLSearchParams(window.location.search).get("inactividad") === "1");
  }, []);
  const recuperar = siguiente ? `/ingresar/recuperar?siguiente=${encodeURIComponent(siguiente)}` : "/ingresar/recuperar";
  return (
    <form action={accion} className="space-y-4">
      {siguiente && <input type="hidden" name="siguiente" value={siguiente} />}
      <label className="block space-y-2">
        <span className="etiqueta">Mail</span>
        <input className="campo" type="email" name="email" autoComplete={compartida ? "off" : "email"} data-lpignore={compartida ? "true" : undefined} data-1p-ignore={compartida ? "" : undefined} required defaultValue={estado.email ?? emailInicial} placeholder="vos@ejemplo.com" />
      </label>
      <label className="block space-y-2">
        <span className="etiqueta">Contraseña</span>
        {compartida
          ? <input className="campo" type="text" name="contrasena" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} required data-compartida
              data-lpignore="true" data-1p-ignore="" data-form-type="other" style={{ WebkitTextSecurity: "disc" } as CSSProperties} />
          : <input className="campo" type="password" name="contrasena" autoComplete="current-password" required />}
      </label>
      {porInactividad && !estado.error && <Mensaje tipo="info">La sesión se cerró por falta de uso. Volvé a ingresar.</Mensaje>}
      {estado.error && (
        <Mensaje tipo="error">{estado.error}{estado.ayuda && <> <a href={estado.ayuda} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 font-semibold" data-ayuda-brik>Escribinos por WhatsApp</a></>}</Mensaje>
      )}
      <button type="submit" disabled={yendo} className="boton boton-principal text-lg w-full !mt-6">
        {yendo ? "Entrando…" : "🔑 Entrar"}
      </button>
      <label className="flex items-center gap-2 text-sm" data-compu-compartida>
        <input type="checkbox" checked={compartida} onChange={(e) => { setCompartida(e.target.checked); guardarCompuCompartida(e.target.checked); }} />
        <span>Esta compu la usa todo el equipo: que el navegador no guarde la contraseña</span>
      </label>
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
