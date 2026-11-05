"use client";
import { useActionState, useEffect, useRef } from "react";
import { entrarConPin, salirDelPin } from "./acciones";

/** Cuatro números grandes; con el cuarto se manda solo. */
export function Teclado({ volver }: { volver: string }) {
  const [estado, accion, mandando] = useActionState(entrarConPin, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (estado.ir) window.location.assign(estado.ir); }, [estado.ir]);
  return (
    <form ref={form} action={accion} className="tarjeta p-6 max-w-sm space-y-4" data-teclado-pin>
      <input type="hidden" name="volver" value={volver} />
      <label className="block space-y-2">
        <span className="etiqueta">Tu PIN</span>
        <input name="pin" autoFocus required inputMode="numeric" pattern="\d{4}" maxLength={4} autoComplete="off" aria-label="PIN"
          className="campo !text-4xl !min-h-20 text-center tracking-[0.6em] numero" type="password"
          onChange={(e) => { if (/^\d{4}$/.test(e.target.value)) form.current?.requestSubmit(); }} />
      </label>
      {estado.error && <p role="alert" className="pildora pildora-rojo whitespace-normal">⚠️ {estado.error}</p>}
      <button type="submit" className="boton boton-principal w-full" disabled={mandando}>🔢 Entrar</button>
    </form>
  );
}

/** Salir del PIN: la compu vuelve a la sesión sola (navega entera, como al entrar). */
export function SalirPin() {
  return <button type="button" className="boton boton-chico" onClick={async () => window.location.assign((await salirDelPin()).ir)}>Salir</button>;
}
