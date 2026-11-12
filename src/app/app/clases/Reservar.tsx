"use client";
import { useOptimistic, useState, useTransition } from "react";
import { reservarClase } from "../acciones";
import { Icono } from "@/components/ui/Icono";

export function Reservar({ claseId, socioId, lleno }: { claseId: string; socioId: string; lleno: boolean }) {
  const [msj, setMsj] = useState<{ ok?: boolean; texto?: string }>({});
  const [ocupado, empezar] = useTransition();
  // F0.4: la reserva se ve hecha al toque; si la base la rechaza, vuelve atrás y dice por qué (el rechazo llega en msj).
  const [vista, reservarYa] = useOptimistic(msj, (_: { ok?: boolean; texto?: string }, nueva: { ok?: boolean }) => nueva);
  return (
    <>
      <button type="button" data-reservar-boton data-reservada={vista.ok ? "si" : "no"} disabled={ocupado || vista.ok} className={`boton !min-h-11 ${lleno ? "texto-suave" : ""}`}
        onClick={() => empezar(async () => { reservarYa({ ok: true }); const r = await reservarClase(claseId, socioId); setMsj(r.error ? { texto: r.error } : { ok: true }); })}>
        {vista.ok ? <><Icono nombre="ok" /></> : lleno ? "Anotarme en espera" : "Reservar"}
      </button>
      {msj.texto && <p role="alert" className="pildora pildora-rojo w-full"><Icono nombre="alerta" /> {msj.texto}</p>}
    </>
  );
}
