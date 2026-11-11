"use client";
import { useState, useTransition } from "react";
import { guardarAvisoClase } from "../ofertas-acciones";
import { Icono } from "@/components/ui/Icono";

/** FA-12: "Avisarme 1 hora antes de mi clase". Apagado por defecto: lo prende el socio. */
export function AvisoClase({ socioId, inicial }: { socioId: string; inicial: boolean }) {
  const [si, setSi] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <div className="tarjeta px-5 py-4 flex items-center gap-3" data-aviso-clase={si ? "si" : "no"}>
      <span className="flex-1 min-w-0"><span className="block font-semibold">Avisarme antes de mi clase</span><span className="block texto-suave text-sm">Un aviso en la app cuando falta menos de 1 hora.</span></span>
      <button type="button" role="switch" aria-checked={si} disabled={ocupado} className={`pildora cursor-pointer !min-h-11 ${si ? "pildora-verde" : ""}`}
        onClick={() => empezar(async () => { const r = await guardarAvisoClase(socioId, !si); if (r.error) setError(r.error); else { setError(null); setSi(!si); } })}>{si ? "Prendido" : "Apagado"}</button>
      {error && <span role="alert" className="text-sm"><Icono nombre="alerta" /> {error}</span>}
    </div>
  );
}
