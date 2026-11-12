"use client";
import { useState, useTransition } from "react";
import { guardarMiPin } from "../pin/acciones";
import { Icono } from "@/components/ui/Icono";

/** CAJ-3: el PIN de 4 números para la compu de la recepción. No reemplaza la contraseña. */
export function MiPin() {
  const [pin, setPin] = useState("");
  const [msj, setMsj] = useState<{ ok?: boolean; texto: string } | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <form className="tarjeta p-5 mt-6 max-w-md space-y-3" data-mi-pin onSubmit={(e) => {
      e.preventDefault();
      empezar(async () => { const r = await guardarMiPin(pin); setMsj(r.error ? { texto: r.error } : { ok: true, texto: "Listo: con ese PIN te anotás en la compu de la recepción." }); if (!r.error) setPin(""); });
    }}>
      <p className="titulo text-xl"><Icono nombre="calculadora" /> Mi PIN para la recepción</p>
      <p className="texto-suave text-sm">4 números. En la compu del mostrador lo ponés y queda anotado que atendiste vos. No sirve para entrar desde otra compu.</p>
      <div className="flex gap-2">
        <input className="campo !w-36 numero text-center tracking-[0.4em]" type="password" inputMode="numeric" maxLength={4} aria-label="PIN nuevo"
          value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        <button type="submit" className="boton" disabled={ocupado || pin.length !== 4}>Guardar PIN</button>
      </div>
      {msj && <p role={msj.ok ? "status" : "alert"} className={`pildora ${msj.ok ? "pildora-verde" : "pildora-rojo"} whitespace-normal`}><Icono nombre={msj.ok ? "ok" : "alerta-circulo"} /> {msj.texto}</p>}
    </form>
  );
}
