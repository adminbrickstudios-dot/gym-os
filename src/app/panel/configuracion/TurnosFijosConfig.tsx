"use client";
import { useState, useTransition } from "react";
import { guardarTurnosFijos } from "./acciones";

/** CLA-2: prender los turnos fijos (se guarda al tocar, aparte del resto de la pestaña). */
export function TurnosFijosConfig({ inicial, puedeEditar }: { inicial: boolean; puedeEditar: boolean }) {
  const [on, setOn] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-3" data-turnos-config={on ? "si" : "no"}>
      <p className="titulo text-2xl">📌 Turnos fijos</p>
      <p className="texto-suave">El socio (o la recepción) elige un horario y cada semana le queda reservado solo, mientras esté al día. Si deja de estar al día, se libera el lugar y sube la espera.</p>
      <label className="flex items-center gap-3 min-h-11">
        <input type="checkbox" className="size-5" checked={on} disabled={!puedeEditar || ocupado}
          onChange={(e) => { const v = e.target.checked; setOn(v); empezar(async () => { const r = await guardarTurnosFijos(v); if (r.error) { setError(r.error); setOn(!v); } else setError(null); }); }} />
        {on ? "Prendidos" : "Apagados"}{ocupado ? " · guardando…" : ""}
      </label>
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
    </section>
  );
}
