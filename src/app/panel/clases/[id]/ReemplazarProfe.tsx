"use client";
// VD-46K: "Falta el profe". Otro profe solo en esta clase, con motivo. La grilla no se toca.
import { useState } from "react";
import { AvisoSalud } from "@/components/ui/AvisoSalud";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { detectarSalud } from "@/lib/salud";
import { reemplazarProfe } from "../acciones";
import { Icono } from "@/components/ui/Icono";

export type Reemplazo = { id: string; creado_en: string; motivo: string; anterior: string | null; nuevo: string; por: string };

export function ReemplazarProfe({ claseId, profeActual, profes, historial, zona, puedeReemplazar }: {
  claseId: string; profeActual: string | null; profes: { id: string; nombre: string }[]; historial: Reemplazo[]; zona: string; puedeReemplazar: boolean;
}) {
  const opciones = profes.filter((p) => p.nombre !== profeActual);
  const [abierto, setAbierto] = useState(false);
  const [profe, setProfe] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const cuando = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  if (!puedeReemplazar && historial.length === 0) return null;
  const guardar = async () => {
    setError(null);
    const r = await reemplazarProfe(claseId, profe, motivo.trim());
    if (r.error) { setError(r.error); return; }
    setAbierto(false); setProfe(""); setMotivo(""); setListo(true);
  };
  return (
    <section className="tarjeta p-5 mb-6 space-y-3" data-reemplazar-profe>
      <p className="titulo text-xl"><Icono nombre="repetir" /> Profe de esta clase</p>
      {historial.length > 0 && (
        <ul className="space-y-1 text-sm texto-suave" data-reemplazos={historial.length}>
          {historial.map((h) => <li key={h.id}>{cuando(h.creado_en)} · {h.anterior ?? "Sin profe"} → <strong>{h.nuevo}</strong> · {h.motivo} ({h.por})</li>)}
        </ul>
      )}
      {listo && <Mensaje tipo="exito"><span data-reemplazo-listo>Listo: el profe nuevo ya puede tomar asistencia en esta clase y el anterior ya no.</span></Mensaje>}
      {puedeReemplazar && (abierto ? (
        <form className="space-y-3" onSubmit={(e) => e.preventDefault()}>
          <label className="block space-y-1"><span className="etiqueta">Quién la da ahora</span>
            <select className="campo" value={profe} onChange={(e) => setProfe(e.target.value)} data-reemplazo-profe>
              <option value="">Elegí un profe…</option>
              {opciones.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select></label>
          <label className="block space-y-1"><span className="etiqueta">Motivo</span>
            <input className="campo" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="No puede venir, se superpone con otra clase…" data-reemplazo-motivo /></label>
          <AvisoSalud texto={motivo} />
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <p className="text-sm texto-tenue">Solo cambia esta clase. Las demás del horario siguen con su profe.</p>
          <div className="flex flex-wrap gap-2">
            <BotonAccion className="boton boton-principal" disabled={!profe || motivo.trim().length < 3 || !!detectarSalud(motivo)} onClick={guardar} ocupadoTexto="Guardando…" data-reemplazo-guardar>Cambiar el profe</BotonAccion>
            <button type="button" className="boton" onClick={() => { setAbierto(false); setError(null); }}>Cancelar</button>
          </div>
        </form>
      ) : (
        opciones.length === 0
          ? <p className="texto-suave text-sm">No hay otro profe cargado para reemplazar. Se suman en Equipo.</p>
          : <button type="button" className="boton" onClick={() => { setAbierto(true); setListo(false); }} data-reemplazo-abrir>Falta el profe: poner a otro</button>
      ))}
    </section>
  );
}
