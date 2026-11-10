"use client";
import { useState, useTransition } from "react";
import { guardarWod } from "../acciones";
import { Icono } from "@/components/ui/Icono";

/** CLA-4: qué se hace en la clase. Lo escriben el profe (en sus clases), el encargado o el dueño; lo ven los anotados en la app. */
export function Wod({ claseId, inicial, por, puedeEditar }: { claseId: string; inicial: string | null; por: string | null; puedeEditar: boolean }) {
  const [texto, setTexto] = useState(inicial ?? "");
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  if (!puedeEditar) return inicial ? <section className="tarjeta p-5 mb-8"><p className="titulo text-xl mb-2"><Icono nombre="pesa" /> WOD</p><p className="whitespace-pre-line">{inicial}</p></section> : null;
  const sucio = texto.trim() !== (inicial ?? "").trim();
  return (
    <section className="tarjeta p-5 mb-8 space-y-3" data-wod>
      <p className="titulo text-xl"><Icono nombre="pesa" /> WOD de esta clase</p>
      <textarea className="campo min-h-28" value={texto} maxLength={2000} onChange={(e) => setTexto(e.target.value)} aria-label="WOD de la clase"
        placeholder="Ej: Calentamiento 10′ · 5 rondas: 10 burpees, 15 sentadillas, 200 m de remo" />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="boton" disabled={!sucio || ocupado}
          onClick={() => empezar(async () => { const r = await guardarWod(claseId, texto); setMsj(r.error ? { error: r.error } : { ok: texto.trim() ? "Guardado: lo ven los anotados en la app." : "Borrado." }); })}>
          {ocupado ? "Guardando…" : "Guardar WOD"}
        </button>
        {por && !sucio && !msj.ok && <span className="text-sm texto-tenue">Lo escribió {por}</span>}
        {msj.ok && !sucio && <span role="status" className="text-sm" style={{ color: "var(--acento)" }}>✓ {msj.ok}</span>}
      </div>
      {msj.error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {msj.error}</p>}
    </section>
  );
}
