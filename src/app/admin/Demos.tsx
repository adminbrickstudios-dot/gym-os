"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { borrarDemosVencidas, crearDemo } from "./acciones";

export type DemoVencida = { gimnasio_id: string; nombre: string; vencio: string };
const TIPOS: [string, string][] = [["", "Sin plantilla"], ["musculacion", "Musculación de barrio"], ["grande", "Gimnasio grande o cadena"]];

/** SA-7: "Crear demo para una reunión" (un gimnasio [demo] que vence a los 7 días) y "Borrar demos vencidas". */
export function Demos({ vencidas }: { vencidas: DemoVencida[] }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("musculacion");
  const [msj, setMsj] = useState<{ ok?: boolean; texto?: string }>({});
  return (
    <section className="space-y-3" id="demos" data-demos>
      <p className="titulo-grupo">Demo para una reunión</p>
      <div className="tarjeta p-4 grid gap-3 sm:grid-cols-3 items-end">
        <label className="space-y-1 sm:col-span-2"><span className="etiqueta">Nombre del interesado</span>
          <input className="campo" value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} placeholder="Gimnasio Olimpo" /></label>
        <label className="space-y-1"><span className="etiqueta">Tipo</span>
          <select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <div className="sm:col-span-3 flex flex-wrap gap-2 items-center">
          <BotonAccion className="boton boton-principal" ocupadoTexto="Creando…" disabled={nombre.trim().length < 2} onClick={async () => {
            const r = await crearDemo(nombre, tipo);
            if (r.error) { setMsj({ texto: r.error }); return; }
            setMsj({ ok: true, texto: r.aviso }); setNombre(""); router.refresh();
          }}>Crear demo</BotonAccion>
          <span className="texto-suave text-sm">Datos ficticios, aparte de los gimnasios reales. A los 7 días queda vencida.</span>
        </div>
        {msj.texto && <p role={msj.ok ? "status" : "alert"} className={`sm:col-span-3 ${msj.ok ? "texto-suave" : "pildora pildora-rojo !rounded-[var(--radio)] !px-4 !py-3"}`}>{msj.texto}</p>}
      </div>
      {vencidas.length > 0 && (
        <div className="tarjeta p-4 space-y-2" data-demos-vencidas>
          <p className="font-semibold">{vencidas.length === 1 ? "1 demo vencida" : `${vencidas.length} demos vencidas`}</p>
          <p className="texto-suave text-sm">{vencidas.map((d) => d.nombre).join(" · ")}</p>
          <BotonAccion className="boton" onClick={async () => { const r = await borrarDemosVencidas(); if (r.error) setMsj({ texto: r.error }); else router.refresh(); }}>Borrar demos vencidas</BotonAccion>
        </div>
      )}
    </section>
  );
}
