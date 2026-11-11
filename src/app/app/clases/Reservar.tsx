"use client";
import { useState, useTransition } from "react";
import { reservarClase } from "../acciones";
import { Icono } from "@/components/ui/Icono";

export function Reservar({ claseId, socioId, lleno }: { claseId: string; socioId: string; lleno: boolean }) {
  const [msj, setMsj] = useState<{ ok?: boolean; texto?: string }>({});
  const [ocupado, empezar] = useTransition();
  return (
    <>
      <button type="button" disabled={ocupado || msj.ok} className={`boton !min-h-11 ${lleno ? "texto-suave" : ""}`}
        onClick={() => empezar(async () => { const r = await reservarClase(claseId, socioId); setMsj(r.error ? { texto: r.error } : { ok: true }); })}>
        {msj.ok ? <><Icono nombre="ok" /></> : lleno ? "Anotarme en espera" : "Reservar"}
      </button>
      {msj.texto && <p role="alert" className="pildora pildora-rojo w-full"><Icono nombre="alerta" /> {msj.texto}</p>}
    </>
  );
}
