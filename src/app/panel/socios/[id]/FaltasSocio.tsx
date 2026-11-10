"use client";
// VD-46Q: las clases que reservó y no vino, con "Perdonar" (motivo obligatorio) para el dueño y el encargado,
// el bloqueo de reservas con "Perdonar el bloqueo", y lo ya perdonado con quién y por qué.
import { useState } from "react";
import { AvisoSalud } from "@/components/ui/AvisoSalud";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { detectarSalud } from "@/lib/salud";
import { perdonarBloqueo, perdonarFalta } from "@/app/panel/clases/acciones";
import { Icono } from "@/components/ui/Icono";

export type DetalleFaltas = {
  puede_perdonar: boolean;
  bloqueo: { hasta: string; texto: string } | null;
  faltas: { reserva_id: string; clase_id: string; actividad: string; inicio: string }[];
  perdonadas: { clase_id: string; actividad: string; inicio: string; motivo: string; por: string; creado_en: string }[];
};

export function FaltasSocio({ socioId, d, zona }: { socioId: string; d: DetalleFaltas; zona: string }) {
  const [quien, setQuien] = useState<string | null>(null);   // clase_id o "bloqueo"
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const cuando = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  if (d.faltas.length === 0 && d.perdonadas.length === 0 && !d.bloqueo) return null;

  const perdonar = async () => {
    setError(null);
    const r = quien === "bloqueo" ? await perdonarBloqueo(socioId, motivo.trim()) : await perdonarFalta(quien!, socioId, motivo.trim());
    if (r.error) { setError(r.error); return; }
    setQuien(null); setMotivo("");
  };
  const formulario = (
    <div className="space-y-2 basis-full" data-form-perdon>
      <input autoFocus className="campo" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="¿Por qué se perdona? Ej: avisó por teléfono" aria-label="Motivo del perdón" />
      <AvisoSalud texto={motivo} />
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <div className="flex flex-wrap gap-2">
        <BotonAccion className="boton boton-principal !min-h-11" disabled={motivo.trim().length < 3 || !!detectarSalud(motivo)} onClick={perdonar} ocupadoTexto="Guardando…" data-confirmar-perdon><Icono nombre="usuarios" /> Perdonar</BotonAccion>
        <button type="button" className="boton !min-h-11" onClick={() => { setQuien(null); setMotivo(""); setError(null); }}>Volver</button>
      </div>
    </div>
  );

  return (
    <section className="mt-8 space-y-3" data-faltas-socio>
      <h2 className="titulo text-2xl"><Icono nombre="persona" /> Reservó y no vino</h2>
      {d.bloqueo && (
        <div className="tarjeta p-4 flex flex-wrap items-center gap-3" data-bloqueo-reservas>
          <p className="min-w-0 flex-1"><Icono nombre="prohibido" /> {d.bloqueo.texto}</p>
          {d.puede_perdonar && quien !== "bloqueo" && <button type="button" className="boton !min-h-11" onClick={() => { setQuien("bloqueo"); setMotivo(""); setError(null); }} data-perdonar-bloqueo><Icono nombre="usuarios" /> Perdonar el bloqueo</button>}
          {quien === "bloqueo" && formulario}
        </div>
      )}
      {d.faltas.length === 0 ? <p className="texto-suave">No tiene faltas sin perdonar.</p> : (
        <ul className="space-y-2">{d.faltas.map((x) => (
          <li key={x.reserva_id} className="flex flex-wrap items-center gap-3 texto-suave" data-falta={x.clase_id}>
            <span className="min-w-0 flex-1">{x.actividad} · <span className="first-letter:uppercase">{cuando(x.inicio)}</span></span>
            {d.puede_perdonar && quien !== x.clase_id && <button type="button" className="boton !min-h-11" onClick={() => { setQuien(x.clase_id); setMotivo(""); setError(null); }} data-perdonar-falta><Icono nombre="usuarios" /> Perdonar</button>}
            {quien === x.clase_id && formulario}
          </li>
        ))}</ul>
      )}
      {d.perdonadas.length > 0 && (
        <div data-faltas-perdonadas={d.perdonadas.length}>
          <p className="etiqueta mb-1">Perdonadas</p>
          <ul className="space-y-1 text-sm texto-suave">{d.perdonadas.map((x) => (
            <li key={`${x.clase_id}-${x.creado_en}`}>{x.actividad} · {cuando(x.inicio)} · “{x.motivo}” ({x.por}, {cuando(x.creado_en)})</li>
          ))}</ul>
        </div>
      )}
    </section>
  );
}
