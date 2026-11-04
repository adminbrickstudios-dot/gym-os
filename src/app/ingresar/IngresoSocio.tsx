"use client";
import { useActionState, useEffect } from "react";
import { pedirCodigo, verificarCodigo, type EstadoCodigo } from "./acciones";
import { Mensaje } from "@/components/ui/Mensaje";

export function IngresoSocio() {
  const [pedido, pedir, pidiendo] = useActionState<EstadoCodigo, FormData>(pedirCodigo, {});
  const [verif, verificar, verificando] = useActionState<EstadoCodigo, FormData>(verificarCodigo, {});
  useEffect(() => { if (verif.destino) window.location.assign(verif.destino); }, [verif.destino]);
  const error = verif.error ?? pedido.error;

  if (!pedido.enviado) {
    return (
      <form action={pedir} className="mt-10 space-y-4">
        <label className="block space-y-2">
          <span className="etiqueta">Tu celular</span>
          <input className="campo !text-xl" type="tel" name="telefono" autoComplete="tel" required placeholder="387 555-1234" defaultValue={pedido.telefono} />
        </label>
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        <button type="submit" disabled={pidiendo} className="boton boton-principal text-lg w-full">{pidiendo ? "Mandando…" : "📲 Mandame el código"}</button>
      </form>
    );
  }
  return (
    <form action={verificar} className="mt-10 space-y-4">
      <input type="hidden" name="telefono" value={pedido.telefono} />
      <p className="texto-suave">Te mandamos un código por SMS a <strong className="text-[var(--texto)]">{pedido.telefono}</strong>.</p>
      <input className="campo !text-3xl !min-h-16 text-center tracking-[0.4em] numero" name="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus placeholder="••••••" aria-label="Código" />
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <button type="submit" disabled={verificando || !!verif.destino} className="boton boton-principal text-lg w-full">{verificando || verif.destino ? "Entrando…" : "✅ Entrar"}</button>
    </form>
  );
}
