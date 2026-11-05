"use client";
import { useActionState, useEffect, useState } from "react";
import { pedirCodigo, pedirCodigoMail, verificarCodigo, verificarCodigoMail, type EstadoCodigo, type EstadoCodigoMail } from "./acciones";
import { FormularioIngreso } from "./FormularioIngreso";
import { Mensaje } from "@/components/ui/Mensaje";

type Via = "celular" | "mail" | "clave";
const VIAS: [Via, string][] = [["celular", "📱 Celular"], ["mail", "✉️ Mail"], ["clave", "🔑 Contraseña"]];

/** El socio entra con un código al celular (por defecto), con un código al mail, o con mail y contraseña (APP-9). */
export function IngresoSocio() {
  const [via, setVia] = useState<Via>("celular");
  return (
    <>
      <div className="flex gap-2 mt-8" role="group" aria-label="Cómo entrar">
        {VIAS.map(([v, t]) => (
          <button key={v} type="button" aria-pressed={via === v} onClick={() => setVia(v)}
            className={`pildora cursor-pointer !min-h-11 ${via === v ? "pildora-azul" : ""}`}>{t}</button>
        ))}
      </div>
      {via === "celular" ? <PorCelular /> : via === "mail" ? <PorMail /> : <FormularioIngreso siguiente="/app" />}
    </>
  );
}

function PorCelular() {
  const [pedido, pedir, pidiendo] = useActionState<EstadoCodigo, FormData>(pedirCodigo, {});
  const [verif, verificar, verificando] = useActionState<EstadoCodigo, FormData>(verificarCodigo, {});
  useEffect(() => { if (verif.destino) window.location.assign(verif.destino); }, [verif.destino]);
  const error = verif.error ?? pedido.error;

  if (!pedido.enviado) {
    return (
      <form action={pedir} className="mt-6 space-y-4">
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
    <form action={verificar} className="mt-6 space-y-4">
      <input type="hidden" name="telefono" value={pedido.telefono} />
      <p className="texto-suave">Te mandamos un código por SMS a <strong className="text-[var(--texto)]">{pedido.telefono}</strong>.</p>
      <Codigo />
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <button type="submit" disabled={verificando || !!verif.destino} className="boton boton-principal text-lg w-full">{verificando || verif.destino ? "Entrando…" : "✅ Entrar"}</button>
    </form>
  );
}

function PorMail() {
  const [pedido, pedir, pidiendo] = useActionState<EstadoCodigoMail, FormData>(pedirCodigoMail, {});
  const [verif, verificar, verificando] = useActionState<EstadoCodigoMail, FormData>(verificarCodigoMail, {});
  useEffect(() => { if (verif.destino) window.location.assign(verif.destino); }, [verif.destino]);
  const error = verif.error ?? pedido.error;

  if (!pedido.enviado) {
    return (
      <form action={pedir} className="mt-6 space-y-4" data-ingreso-mail>
        <label className="block space-y-2">
          <span className="etiqueta">Tu mail</span>
          <input className="campo !text-xl" type="email" name="email" autoComplete="email" required placeholder="vos@ejemplo.com" defaultValue={pedido.email} />
        </label>
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        <button type="submit" disabled={pidiendo} className="boton boton-principal text-lg w-full">{pidiendo ? "Mandando…" : "✉️ Mandame el código"}</button>
      </form>
    );
  }
  return (
    <form action={verificar} className="mt-6 space-y-4" data-ingreso-mail>
      <input type="hidden" name="email" value={pedido.email} />
      <p className="texto-suave">Te mandamos un código a <strong className="text-[var(--texto)]">{pedido.email}</strong>. Mirá también en spam.</p>
      <Codigo />
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <button type="submit" disabled={verificando || !!verif.destino} className="boton boton-principal text-lg w-full">{verificando || verif.destino ? "Entrando…" : "✅ Entrar"}</button>
    </form>
  );
}

const Codigo = () => (
  <input className="campo !text-3xl !min-h-16 text-center tracking-[0.4em] numero" name="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required autoFocus placeholder="••••••" aria-label="Código" />
);
