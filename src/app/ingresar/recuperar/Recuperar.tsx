"use client";
import { startTransition, useActionState, useEffect, useState } from "react";
import { guardarContrasenaNueva, pedirRecuperacion, verificarRecuperacion, type EstadoRecuperar } from "../acciones";
import { PasoCodigo } from "@/components/cuentas/PasoCodigo";
import { Mensaje } from "@/components/ui/Mensaje";
import { DesafioTurnstile } from "@/components/cuentas/DesafioTurnstile";

/** Tres pasos en el mismo lugar: el mail, el código de 6 dígitos y la contraseña nueva. Nunca dice si el mail tiene cuenta. */
export function Recuperar({ siguiente, emailInicial }: { siguiente: string | null; emailInicial?: string }) {
  const [intento, setIntento] = useState(0);
  return <Pasos key={intento} siguiente={siguiente} emailInicial={emailInicial} otraVez={() => setIntento((i) => i + 1)} />;
}

function Pasos({ siguiente, emailInicial, otraVez }: { siguiente: string | null; emailInicial?: string; otraVez: () => void }) {
  const [pedido, pedir, pidiendo] = useActionState<EstadoRecuperar, FormData>(pedirRecuperacion, {});
  const [verif, verificar, verificando] = useActionState<EstadoRecuperar, FormData>(verificarRecuperacion, {});
  const [nueva, guardar, guardando] = useActionState<EstadoRecuperar, FormData>(guardarContrasenaNueva, {});
  const [email, setEmail] = useState(emailInicial ?? "");
  const [enCodigo, setEnCodigo] = useState(false);
  const [visto, setVisto] = useState<EstadoRecuperar>(pedido);
  if (pedido !== visto) { setVisto(pedido); if (pedido.enviado) setEnCodigo(true); }
  useEffect(() => { if (nueva.destino) window.location.assign(nueva.destino); }, [nueva.destino]);

  if (verif.verificado) {
    return (
      <form action={guardar} className="space-y-4" data-paso-nueva>
        <input type="hidden" name="email" value={verif.email ?? email} />
        {siguiente && <input type="hidden" name="siguiente" value={siguiente} />}
        <label className="block space-y-2">
          <span className="etiqueta">Contraseña nueva</span>
          <input className="campo" type="password" name="contrasena" autoComplete="new-password" minLength={8} required autoFocus />
          <span className="texto-tenue text-sm">Al menos 8 caracteres.</span>
        </label>
        <label className="block space-y-2">
          <span className="etiqueta">Repetila</span>
          <input className="campo" type="password" name="repetir" autoComplete="new-password" minLength={8} required />
        </label>
        {nueva.error && <Mensaje tipo="error">{nueva.error}</Mensaje>}
        <button type="submit" disabled={guardando || !!nueva.destino} className="boton boton-principal text-lg w-full">
          {guardando || nueva.destino ? "Guardando…" : "Guardar y entrar"}
        </button>
        <button type="button" onClick={otraVez} className="underline underline-offset-4 texto-suave cursor-pointer min-h-11 w-full text-sm">Empezar de nuevo</button>
      </form>
    );
  }
  if (enCodigo) {
    return (
      <PasoCodigo
        accion={verificar} ocultos={{ email }}
        intro={<>Si <strong className="text-[var(--texto)]">{email}</strong> tiene una cuenta, te llegó un código. Mirá también en spam.</>}
        error={verif.error ?? nueva.error ?? pedido.error} intento={verif} envio={pedido}
        entrando={verificando} textoBoton="Seguir"
        reenviar={() => startTransition(() => { const f = new FormData(); f.set("email", email); pedir(f); })}
        reenviando={pidiendo} cambiar={otraVez}
      />
    );
  }
  return (
    <form action={pedir} className="space-y-4" data-paso-mail>
      <label className="block space-y-2">
        <span className="etiqueta">Mail de tu cuenta</span>
        <input className="campo" type="email" name="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@ejemplo.com" />
      </label>
      <DesafioTurnstile />
      {pedido.error && <Mensaje tipo="error">{pedido.error}</Mensaje>}
      <button type="submit" disabled={pidiendo} className="boton boton-principal text-lg w-full">{pidiendo ? "Mandando…" : "Mandame el código"}</button>
    </form>
  );
}
