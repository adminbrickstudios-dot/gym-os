"use client";
import { useState, useTransition } from "react";
import { agregarHorario, cerrarHorario, editarActividad, editarHorario, guardarActividad } from "./acciones";
import { Mensaje } from "@/components/ui/Mensaje";

export type Actividad = { actividad_id: string; nombre: string; emoji: string | null; activa: boolean; horarios: number };
export type Horario = { horario_id: string; sede: string; actividad: string; emoji: string | null; dia_semana: number; hora_inicio: string; duracion_min: number; cupo: number | null; profe: string | null; profe_id: string | null; vigente_desde: string; vigente_hasta: string | null };
type Opcion = { id: string; nombre: string };

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** `soloLectura` (VD-60, D34): la recepción y el profe ven la grilla pero no la arman (la base solo deja escribir al dueño y al encargado). */
export function Grilla({ actividades, horarios, sedes, profes, hoy, soloLectura = false }: { actividades: Actividad[]; horarios: Horario[]; sedes: Opcion[]; profes: Opcion[]; hoy: string; soloLectura?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const [nueva, setNueva] = useState({ nombre: "", emoji: "" });
  // AUD-9: confirmar sin el diálogo del navegador (se ve feo y frena todo): el botón pasa a "¿Sacar? Sí / No".
  const [sacando, setSacando] = useState<string | null>(null);
  // CLA-8: editar un horario o una actividad en el lugar.
  const [editando, setEditando] = useState<{ id: string; hora: string; duracion: number; cupo: string; profe: string } | null>(null);
  const [actEdit, setActEdit] = useState<{ id: string; nombre: string; emoji: string; activa: boolean } | null>(null);
  const activas = actividades.filter((a) => a.activa);
  const [h, setH] = useState({ sede: sedes[0]?.id ?? "", actividad: activas[0]?.actividad_id ?? "", dia: 1, hora: "19:00", duracion: 60, cupo: "", profe: "" });
  const correr = (f: () => Promise<{ error?: string }>, despues?: () => void) => empezar(async () => { const r = await f(); setError(r.error ?? null); if (!r.error) despues?.(); });

  return (
    <div className="space-y-10">
      {error && <Mensaje tipo="error">{error}</Mensaje>}

      <section>
        <h2 className="titulo text-3xl mb-4">💪 Actividades</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {actividades.map((a) => (
            soloLectura ? (
              <span key={a.actividad_id} className={`pildora !text-base !py-2 !px-4 ${a.activa ? "" : "opacity-50"}`}>
                {a.emoji ?? "🗓️"} {a.nombre} <span className="texto-tenue">· {a.activa ? `${a.horarios} horarios` : "apagada"}</span>
              </span>
            ) : <button key={a.actividad_id} type="button" onClick={() => setActEdit({ id: a.actividad_id, nombre: a.nombre, emoji: a.emoji ?? "", activa: a.activa })}
              className={`pildora !text-base !py-2 !px-4 ${a.activa ? "" : "opacity-50"}`} aria-label={`Editar ${a.nombre}`}>
              {a.emoji ?? "🗓️"} {a.nombre} <span className="texto-tenue">· {a.activa ? `${a.horarios} horarios` : "apagada"}</span>
            </button>
          ))}
          {actividades.length === 0 && <p className="texto-suave">Todavía no hay actividades. Empezá por una (ej: 🚴 Spinning).</p>}
        </div>
        {actEdit && (
          <form className="tarjeta p-4 mb-4 flex flex-wrap items-center gap-2" data-editar-actividad onSubmit={(e) => { e.preventDefault(); correr(() => editarActividad(actEdit.id, actEdit.nombre, actEdit.emoji, actEdit.activa), () => setActEdit(null)); }}>
            <input className="campo !w-20 text-center text-xl" value={actEdit.emoji} onChange={(e) => setActEdit({ ...actEdit, emoji: e.target.value })} aria-label="Emoji de la actividad" />
            <input className="campo !w-auto flex-1 min-w-48" value={actEdit.nombre} onChange={(e) => setActEdit({ ...actEdit, nombre: e.target.value })} aria-label="Nombre (editar)" />
            <label className="flex items-center gap-2 min-h-11"><input type="checkbox" className="size-5" checked={actEdit.activa} onChange={(e) => setActEdit({ ...actEdit, activa: e.target.checked })} /> Activa</label>
            <button type="submit" className="boton" disabled={ocupado || !actEdit.nombre.trim()}>Guardar</button>
            <button type="button" className="boton-texto texto-suave" onClick={() => setActEdit(null)}>Cancelar</button>
            {!actEdit.activa && <p className="basis-full text-sm texto-tenue">Apagada: sus horarios dejan de generar clases nuevas.</p>}
          </form>
        )}
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); correr(() => guardarActividad(null, nueva.nombre, nueva.emoji), () => setNueva({ nombre: "", emoji: "" })); }}>
          <input className="campo !w-20 text-center text-xl" placeholder="🚴" value={nueva.emoji} onChange={(e) => setNueva({ ...nueva, emoji: e.target.value })} aria-label="Emoji" />
          <input className="campo !w-auto flex-1 min-w-48" placeholder="Nombre de la actividad" value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} aria-label="Nombre de la actividad" />
          <button type="submit" disabled={!nueva.nombre.trim() || ocupado} className="boton">➕ Agregar actividad</button>
        </form>
      </section>

      <section>
        <h2 className="titulo text-3xl mb-4">🗓️ Grilla de la semana</h2>
        {DIAS.map((d, i) => {
          const del = horarios.filter((x) => x.dia_semana === i + 1);
          if (!del.length) return null;
          return (
            <div key={d} className="mb-5">
              <p className="titulo-grupo mb-2">{d}</p>
              <ul className="space-y-1.5">
                {del.map((x) => (
                  <li key={x.horario_id} className="tarjeta flex flex-wrap items-center gap-4 px-4 py-3">
                    <span className="numero text-2xl w-16">{x.hora_inicio.slice(0, 5)}</span>
                    <span aria-hidden className="text-xl">{x.emoji ?? "🗓️"}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold truncate">{x.actividad}</span>
                      <span className="block text-sm texto-suave truncate">{x.duracion_min} min{x.cupo ? ` · cupo ${x.cupo}` : " · sin cupo"}{x.profe ? ` · ${x.profe}` : ""}{sedes.length > 1 ? ` · ${x.sede}` : ""}{x.vigente_hasta ? ` · hasta el ${x.vigente_hasta.slice(8, 10)}/${x.vigente_hasta.slice(5, 7)}` : ""}{x.vigente_desde > hoy ? ` · desde el ${x.vigente_desde.slice(8, 10)}/${x.vigente_desde.slice(5, 7)}` : ""}</span>
                    </span>
                    {!soloLectura && editando?.id !== x.horario_id && sacando !== x.horario_id && (
                      <button type="button" className="boton boton-chico" onClick={() => setEditando({ id: x.horario_id, hora: x.hora_inicio.slice(0, 5), duracion: x.duracion_min, cupo: x.cupo ? String(x.cupo) : "", profe: x.profe_id ?? "" })}
                        aria-label={`Editar ${x.actividad} de los ${d.toLowerCase()} ${x.hora_inicio.slice(0, 5)}`}>Editar</button>
                    )}
                    {soloLectura ? null : editando?.id === x.horario_id ? (
                      <form className="basis-full grid grid-cols-2 sm:grid-cols-5 gap-2 items-end" data-editar-horario onSubmit={(e) => {
                        e.preventDefault();
                        correr(() => editarHorario(x.horario_id, { hora: editando.hora, duracion: editando.duracion, cupo: editando.cupo ? Number(editando.cupo) : null, profe: editando.profe || null }), () => setEditando(null));
                      }}>
                        <label className="space-y-1"><span className="etiqueta">Hora</span><input type="time" className="campo" value={editando.hora} onChange={(e) => setEditando({ ...editando, hora: e.target.value })} /></label>
                        <label className="space-y-1"><span className="etiqueta">Minutos</span><input type="number" min={10} max={300} className="campo" value={editando.duracion} onChange={(e) => setEditando({ ...editando, duracion: Number(e.target.value) })} /></label>
                        <label className="space-y-1"><span className="etiqueta">Cupo</span><input type="number" min={1} className="campo" placeholder="Sin cupo" value={editando.cupo} onChange={(e) => setEditando({ ...editando, cupo: e.target.value })} /></label>
                        <label className="space-y-1"><span className="etiqueta">Profe</span><select className="campo" value={editando.profe} onChange={(e) => setEditando({ ...editando, profe: e.target.value })}><option value="">Sin asignar</option>{profes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
                        <span className="flex gap-2"><button type="submit" className="boton" disabled={ocupado}>Guardar</button><button type="button" className="boton-texto texto-suave" onClick={() => setEditando(null)}>Cancelar</button></span>
                        <p className="col-span-2 sm:col-span-5 text-sm texto-tenue">Vale para las próximas clases. Las que ya tienen reservas conservan su hora; nadie pierde su lugar.</p>
                      </form>
                    ) : sacando === x.horario_id ? (
                      <span className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirmar">
                        <span className="text-sm texto-suave">Se cancelan las clases desde hoy y se avisa a los anotados.</span>
                        <button type="button" className="boton boton-chico boton-peligro" disabled={ocupado} onClick={() => correr(() => cerrarHorario(x.horario_id), () => setSacando(null))}>Sí, sacar</button>
                        <button type="button" className="boton boton-chico" onClick={() => setSacando(null)}>No</button>
                      </span>
                    ) : (
                      <button type="button" className="boton boton-chico texto-suave" disabled={ocupado} onClick={() => setSacando(x.horario_id)}
                        aria-label={`Sacar ${x.actividad} de los ${d.toLowerCase()} ${x.hora_inicio.slice(0, 5)}`}>Sacar</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {horarios.length === 0 && <p className="texto-suave mb-4">La grilla está vacía.</p>}

        {!soloLectura && activas.length > 0 && (
          <form className="tarjeta p-5 mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3" onSubmit={(e) => {
            e.preventDefault();
            correr(() => agregarHorario({ sede: h.sede, actividad: h.actividad, dia: h.dia, hora: h.hora, duracion: h.duracion, cupo: h.cupo ? Number(h.cupo) : null, profe: h.profe || null }));
          }}>
            <p className="titulo text-xl sm:col-span-2 lg:col-span-3">➕ Agregar a la grilla</p>
            <label className="space-y-1"><span className="etiqueta">Actividad</span>
              <select className="campo" value={h.actividad} onChange={(e) => setH({ ...h, actividad: e.target.value })}>{activas.map((a) => <option key={a.actividad_id} value={a.actividad_id}>{a.emoji} {a.nombre}</option>)}</select></label>
            <label className="space-y-1"><span className="etiqueta">Día</span>
              <select className="campo" value={h.dia} onChange={(e) => setH({ ...h, dia: Number(e.target.value) })}>{DIAS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></label>
            <label className="space-y-1"><span className="etiqueta">Hora</span>
              <input type="time" className="campo" value={h.hora} onChange={(e) => setH({ ...h, hora: e.target.value })} /></label>
            <label className="space-y-1"><span className="etiqueta">Duración (min)</span>
              <input type="number" min={10} max={300} className="campo" value={h.duracion} onChange={(e) => setH({ ...h, duracion: Number(e.target.value) })} /></label>
            <label className="space-y-1"><span className="etiqueta">Cupo</span>
              <input type="number" min={1} className="campo" placeholder="Sin cupo" value={h.cupo} onChange={(e) => setH({ ...h, cupo: e.target.value })} /></label>
            <label className="space-y-1"><span className="etiqueta">Profe</span>
              <select className="campo" value={h.profe} onChange={(e) => setH({ ...h, profe: e.target.value })}><option value="">Sin asignar</option>{profes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
            {sedes.length > 1 && <label className="space-y-1"><span className="etiqueta">Sede</span>
              <select className="campo" value={h.sede} onChange={(e) => setH({ ...h, sede: e.target.value })}>{sedes.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></label>}
            <div className="sm:col-span-2 lg:col-span-3"><button type="submit" disabled={ocupado} className="boton boton-principal">➕ Agregar</button></div>
          </form>
        )}
      </section>
    </div>
  );
}
