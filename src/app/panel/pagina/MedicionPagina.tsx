"use client";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarMedicion } from "./acciones";
import { Icono } from "@/components/ui/Icono";

export type MedicionPanel = { pixel_meta: string | null; google_analytics: string | null; publicada: boolean };

/** COM-11: el ID del píxel de Meta y el de Google Analytics. Solo IDs: la página publicada arma el código. */
export function MedicionPagina({ inicial, puedeEditar }: { inicial: MedicionPanel; puedeEditar: boolean }) {
  const [m, setM] = useState(inicial);
  const [px, setPx] = useState(inicial.pixel_meta ?? "");
  const [ga, setGa] = useState(inicial.google_analytics ?? "");
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  const sucio = px.trim() !== (m.pixel_meta ?? "") || ga.trim().toUpperCase() !== (m.google_analytics ?? "");
  return (
    <section className="tarjeta p-5 space-y-3 mt-6" data-medicion>
      <p className="titulo text-xl"><Icono nombre="grafico" /> Medir las visitas</p>
      <p className="texto-suave">Si hacés publicidad en Instagram o Facebook, o usás Google Analytics, pegá acá los IDs y la página los carga sola. Solo el número del píxel y el código G-…, nunca código entero.</p>
      <label className="block">
        <span className="text-sm">ID del píxel de Meta</span>
        <input className="campo w-full" inputMode="numeric" value={px} disabled={!puedeEditar} onChange={(e) => setPx(e.target.value)} placeholder="Ej: 123456789012345" aria-label="ID del píxel de Meta" />
      </label>
      <label className="block">
        <span className="text-sm">ID de Google Analytics</span>
        <input className="campo w-full" autoCapitalize="characters" spellCheck={false} value={ga} disabled={!puedeEditar} onChange={(e) => setGa(e.target.value)} placeholder="Ej: G-AB12CD34EF" aria-label="ID de Google Analytics" />
      </label>
      {!m.publicada && (m.pixel_meta || m.google_analytics) && <p className="text-sm texto-suave">La página no está publicada: se van a cargar cuando la publiques.</p>}
      {puedeEditar && <button type="button" className="boton" disabled={ocupado || !sucio}
        onClick={() => empezar(async () => {
          const r = await guardarMedicion(px, ga);
          if (r.error || !r.medicion) { setMsj({ error: r.error ?? "No se pudo guardar" }); return; }
          setM(r.medicion); setPx(r.medicion.pixel_meta ?? ""); setGa(r.medicion.google_analytics ?? ""); setMsj({ ok: "Guardado." });
        })}>Guardar</button>}
      {msj.ok && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
    </section>
  );
}
