"use client";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { guardarPruebaSocial } from "./acciones";
import { Icono } from "@/components/ui/Icono";

export type PruebaSocialPanel = { mostrar_socios: boolean; resena_puntaje: number | string | null; resena_cantidad: number | null; link_resena: string | null; socios_ahora: number | null };

/** VD-25: lo que la portada muestra para dar confianza: "+N socios" y las reseñas de Google (las escribe el dueño). */
export function PruebaSocial({ inicial, puedeEditar }: { inicial: PruebaSocialPanel; puedeEditar: boolean }) {
  const [p, setP] = useState(inicial);
  const [socios, setSocios] = useState(inicial.mostrar_socios);
  const [puntaje, setPuntaje] = useState(inicial.resena_puntaje == null ? "" : String(inicial.resena_puntaje));
  const [cantidad, setCantidad] = useState(inicial.resena_cantidad == null ? "" : String(inicial.resena_cantidad));
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  const sucio = socios !== p.mostrar_socios || puntaje.trim() !== (p.resena_puntaje == null ? "" : String(p.resena_puntaje)) || cantidad.trim() !== (p.resena_cantidad == null ? "" : String(p.resena_cantidad));
  return (
    <section className="tarjeta p-5 space-y-3 mt-6" data-prueba-social-panel>
      <p className="titulo text-xl"><Icono nombre="estrella" /> Confianza en la portada</p>
      <p className="texto-suave">Debajo del título, la gente ve cuántos socios son y qué puntaje tienen en Google. Solo se muestra lo que prendas acá.</p>
      <label className="flex items-center gap-3 min-h-11">
        <input type="checkbox" checked={socios} disabled={!puedeEditar} onChange={(e) => setSocios(e.target.checked)} />
        <span>Mostrar “+{p.socios_ahora ?? "…"} socios”{p.socios_ahora == null && <span className="texto-suave"> (se muestra desde 20 socios)</span>}</span>
      </label>
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <label className="block"><span className="text-sm">Puntaje en Google</span>
          <input className="campo w-full" inputMode="decimal" value={puntaje} disabled={!puedeEditar} onChange={(e) => setPuntaje(e.target.value)} placeholder="Ej: 4,8" aria-label="Puntaje en Google" /></label>
        <label className="block"><span className="text-sm">Cantidad de reseñas</span>
          <input className="campo w-full" inputMode="numeric" value={cantidad} disabled={!puedeEditar} onChange={(e) => setCantidad(e.target.value)} placeholder="Ej: 120" aria-label="Cantidad de reseñas" /></label>
      </div>
      {!p.link_resena && <p className="text-sm texto-suave">Para que el puntaje lleve a tus reseñas, pegá el link en Configuración → Mensajes → Reseñas en Google.</p>}
      {puedeEditar && <button type="button" className="boton" disabled={ocupado || !sucio}
        onClick={() => empezar(async () => {
          const r = await guardarPruebaSocial(socios, puntaje, cantidad);
          if (r.error || !r.prueba) { setMsj({ error: r.error ?? "No se pudo guardar" }); return; }
          setP(r.prueba); setSocios(r.prueba.mostrar_socios);
          setPuntaje(r.prueba.resena_puntaje == null ? "" : String(r.prueba.resena_puntaje)); setCantidad(r.prueba.resena_cantidad == null ? "" : String(r.prueba.resena_cantidad));
          setMsj({ ok: "Guardado." });
        })}>Guardar</button>}
      {msj.ok && <Mensaje tipo="exito">{msj.ok}</Mensaje>}
      {msj.error && <Mensaje tipo="error">{msj.error}</Mensaje>}
    </section>
  );
}
