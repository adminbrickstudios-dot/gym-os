"use client";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { leerNumeros, type MapaLugares, type OcupadoEquipo } from "@/lib/clases/lugares";
import { guardarLugares } from "../acciones";

/**
 * COM-12: la sala numerada de esta clase. El profe y la recepción ven quién
 * está en cada lugar; el dueño y el encargado la numeran (vale para esta
 * actividad en esta sede) y marcan los que están fuera de servicio.
 */
export function Lugares({ claseId, mapa, puedeNumerar }: { claseId: string; mapa: MapaLugares<OcupadoEquipo> | null; puedeNumerar: boolean }) {
  const [editando, setEditando] = useState(false);
  const [cantidad, setCantidad] = useState(String(mapa?.cantidad ?? ""));
  const [etiqueta, setEtiqueta] = useState(mapa?.etiqueta ?? "Bici");
  const [fuera, setFuera] = useState((mapa?.fuera_servicio ?? []).join(", "));
  const [msj, setMsj] = useState<{ ok?: string; error?: string }>({});
  const [ocupado, empezar] = useTransition();
  if (!mapa && !puedeNumerar) return null;
  const de = new Map((mapa?.ocupados ?? []).map((o) => [o.lugar, o]));
  const roto = new Set(mapa?.fuera_servicio ?? []);
  return (
    <section className="mt-10" aria-labelledby="lugares" data-lugares-clase>
      <h2 id="lugares" className="titulo text-2xl mb-1">📍 Lugares en la sala</h2>
      {mapa ? (
        <>
          <p className="texto-suave mb-3">{mapa.ocupados.length} de {mapa.cantidad - roto.size} {mapa.etiqueta.toLowerCase()}s elegidas. Cada socio elige la suya en la app al reservar.</p>
          <ul className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {Array.from({ length: mapa.cantidad }, (_, i) => i + 1).map((n) => (
              <li key={n} data-lugar={n} className={`tarjeta px-3 py-2 ${roto.has(n) ? "opacity-50" : ""}`}>
                <span className="numero text-lg">{n}</span>
                <span className="block text-xs truncate">{roto.has(n) ? "Fuera de servicio" : de.get(n)?.nombre ?? <span className="texto-suave">Libre</span>}</span>
              </li>
            ))}
          </ul>
        </>
      ) : <p className="texto-suave mb-3">¿Esta clase usa máquinas (bicis, reformers)? Numerá la sala y cada socio elige su lugar al reservar.</p>}
      {puedeNumerar && !editando && <button type="button" className="boton mt-3" onClick={() => setEditando(true)}>{mapa ? "⚙️ Cambiar la sala" : "⚙️ Numerar la sala"}</button>}
      {puedeNumerar && editando && (
        <form className="tarjeta p-5 mt-3 space-y-3" data-numerar-sala onSubmit={(e) => {
          e.preventDefault();
          empezar(async () => {
            const r = await guardarLugares(claseId, Number(cantidad) || 0, etiqueta, leerNumeros(fuera));
            if (r.error) setMsj({ error: r.error }); else { setMsj({ ok: Number(cantidad) ? "Guardado: vale para todas las clases de esta actividad en esta sede." : "Listo: la sala ya no está numerada." }); setEditando(false); }
          });
        }}>
          <p className="texto-suave text-sm">Vale para todas las clases de esta actividad en esta sede. Dejá la cantidad en 0 para sacar la numeración.</p>
          <div className="flex flex-wrap gap-3">
            <label className="block"><span className="text-sm">Cuántos lugares</span>
              <input className="campo w-28" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ""))} aria-label="Cuántos lugares" /></label>
            <label className="block"><span className="text-sm">Cómo se llaman</span>
              <input className="campo w-36" maxLength={20} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="Bici" aria-label="Cómo se llaman los lugares" /></label>
            <label className="block grow"><span className="text-sm">Fuera de servicio</span>
              <input className="campo w-full" value={fuera} onChange={(e) => setFuera(e.target.value)} placeholder="Ej: 7, 12" aria-label="Lugares fuera de servicio" /></label>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="boton boton-principal" disabled={ocupado}>Guardar</button>
            <button type="button" className="boton" onClick={() => setEditando(false)}>Cancelar</button>
          </div>
        </form>
      )}
      {msj.ok && <Mensaje tipo="exito" className="mt-3">{msj.ok}</Mensaje>}
      {msj.error && <Mensaje tipo="error" className="mt-3">{msj.error}</Mensaje>}
    </section>
  );
}
