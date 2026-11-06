"use client";
// VD-44 · Foto, qué clases da y horario de trabajo de cada persona del equipo; y la opción general
// de mostrarlos en la página y la app (solo el dueño la prende, y cada persona se tilda aparte).
import { useState, useTransition } from "react";
import { NOMBRE_ROL, type Rol } from "@/lib/panel/secciones";
import { guardarMostrarEquipo, guardarPerfil, quitarFotoEquipo, subirFotoEquipo, type HorarioTrabajo } from "./acciones";

export type PerfilEquipo = { equipo_id: string; mostrar: boolean; tiene_foto: boolean; actividades: string[]; horario: HorarioTrabajo[] };
export type PerfilesDatos = { mostrar_en_pagina_y_app: boolean; actividades: { id: string; nombre: string; emoji: string | null }[]; personas: PerfilEquipo[] };
type Persona = { equipo_id: string; nombre: string; rol: Rol };

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

export function Perfiles({ personas, datos, esDueno }: { personas: Persona[]; datos: PerfilesDatos; esDueno: boolean }) {
  const [prendido, setPrendido] = useState(datos.mostrar_en_pagina_y_app);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const porId = new Map(datos.personas.map((p) => [p.equipo_id, p]));
  return (
    <section className="space-y-4" data-perfiles aria-labelledby="titulo-perfiles">
      <div>
        <h2 id="titulo-perfiles" className="titulo text-2xl">📸 Fotos, clases y horarios</h2>
        <p className="texto-suave">La foto de cada uno, qué clases da y cuándo trabaja. El horario de trabajo es interno: no sale afuera.</p>
      </div>
      <label className="tarjeta flex items-start gap-3 px-4 py-4">
        <input type="checkbox" className="mt-1 size-5" data-mostrar-equipo checked={prendido} disabled={!esDueno || ocupado}
          onChange={(e) => { const v = e.target.checked; setPrendido(v); empezar(async () => { const r = await guardarMostrarEquipo(v); if (r.error) { setPrendido(!v); } setError(r.error ?? null); }); }} />
        <span>
          <span className="block font-semibold">Mostrar al equipo en la página y en la app</span>
          <span className="block texto-suave text-sm">
            {prendido ? "Prendido: se ven solo las personas que tildes abajo (nombre, foto y clases; en la app, “Profe: …” en cada clase)."
              : "Apagado: nadie del equipo aparece en la página ni en la app del socio."}
            {!esDueno && " Lo cambia el dueño."}
          </span>
        </span>
      </label>
      {error && <p role="alert" className="pildora pildora-rojo !rounded-2xl !px-4 !py-3">⚠️ {error}</p>}
      <ul className="space-y-2">
        {personas.map((p) => <Ficha key={p.equipo_id} persona={p} perfil={porId.get(p.equipo_id) ?? { equipo_id: p.equipo_id, mostrar: false, tiene_foto: false, actividades: [], horario: [] }} actividades={datos.actividades} />)}
      </ul>
    </section>
  );
}

function Ficha({ persona, perfil, actividades }: { persona: Persona; perfil: PerfilEquipo; actividades: PerfilesDatos["actividades"] }) {
  const [abierto, setAbierto] = useState(false);
  const [tieneFoto, setTieneFoto] = useState(perfil.tiene_foto);
  const [version, setVersion] = useState(0);
  const [mostrar, setMostrar] = useState(perfil.mostrar);
  const [acts, setActs] = useState<string[]>(perfil.actividades);
  const [horario, setHorario] = useState<HorarioTrabajo[]>(perfil.horario);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [ocupado, empezar] = useTransition();

  const subir = (archivo: File | undefined) => {
    if (!archivo) return;
    const f = new FormData(); f.set("foto", archivo);
    empezar(async () => {
      const r = await subirFotoEquipo(persona.equipo_id, f);
      if (r.error) setMensaje({ tipo: "error", texto: r.error }); else { setTieneFoto(true); setVersion((v) => v + 1); setMensaje({ tipo: "ok", texto: "Foto guardada." }); }
    });
  };
  const quitar = () => empezar(async () => {
    const r = await quitarFotoEquipo(persona.equipo_id);
    if (r.error) setMensaje({ tipo: "error", texto: r.error }); else { setTieneFoto(false); setMensaje({ tipo: "ok", texto: "Foto quitada." }); }
  });
  const guardar = () => empezar(async () => {
    const r = await guardarPerfil(persona.equipo_id, mostrar, acts, horario);
    setMensaje(r.error ? { tipo: "error", texto: r.error } : { tipo: "ok", texto: "Guardado." });
  });
  const cambiar = (i: number, parte: Partial<HorarioTrabajo>) => setHorario((h) => h.map((x, j) => (j === i ? { ...x, ...parte } : x)));

  return (
    <li className="tarjeta px-4 py-4 space-y-4" data-perfil={persona.nombre}>
      <div className="flex flex-wrap items-center gap-4">
        {tieneFoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/foto-equipo/${persona.equipo_id}?v=${version}`} alt={`Foto de ${persona.nombre}`} data-foto-equipo className="size-16 rounded-2xl object-cover" />
        ) : (
          <span aria-hidden className="size-16 rounded-2xl grid place-items-center titulo text-2xl bg-[var(--tarjeta-alta)]">{iniciales(persona.nombre)}</span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-lg">{persona.nombre}</span>
          <span className="block texto-suave text-sm">{NOMBRE_ROL[persona.rol]}{acts.length ? ` · ${acts.length} ${acts.length === 1 ? "actividad" : "actividades"}` : ""}</span>
        </span>
        <button type="button" className="boton boton-chico" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>{abierto ? "Cerrar" : "Editar"}</button>
      </div>
      {abierto && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <label className="boton boton-chico cursor-pointer">
              {tieneFoto ? "Cambiar foto" : "📷 Subir foto"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`Foto de ${persona.nombre}`} disabled={ocupado}
                onChange={(e) => { subir(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {tieneFoto && <button type="button" className="boton boton-chico texto-suave" disabled={ocupado} onClick={quitar}>Quitar foto</button>}
          </div>

          <fieldset className="space-y-2">
            <legend className="etiqueta">Qué clases da</legend>
            {actividades.length === 0 ? <p className="texto-suave text-sm">Todavía no hay actividades. Se crean en Clases.</p> : (
              <div className="flex flex-wrap gap-2">
                {actividades.map((a) => (
                  <label key={a.id} className={`boton boton-chico cursor-pointer ${acts.includes(a.id) ? "!border-[var(--acento)]" : "opacity-70"}`}>
                    <input type="checkbox" className="sr-only" checked={acts.includes(a.id)} data-actividad={a.nombre}
                      onChange={(e) => setActs((x) => (e.target.checked ? [...x, a.id] : x.filter((y) => y !== a.id)))} />
                    {a.emoji ?? "🗓️"} {a.nombre}
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="etiqueta">Horario de trabajo</legend>
            {horario.length === 0 && <p className="texto-suave text-sm">Sin horario cargado.</p>}
            {horario.map((h, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2" data-franja>
                <select aria-label="Día" className="campo !w-auto" value={h.dia} onChange={(e) => cambiar(i, { dia: Number(e.target.value) })}>
                  {DIAS.map((d, n) => <option key={d} value={n + 1}>{d}</option>)}
                </select>
                <input type="time" aria-label="Desde" className="campo !w-auto" value={h.desde} onChange={(e) => cambiar(i, { desde: e.target.value })} />
                <span className="texto-suave">a</span>
                <input type="time" aria-label="Hasta" className="campo !w-auto" value={h.hasta} onChange={(e) => cambiar(i, { hasta: e.target.value })} />
                <button type="button" className="boton-texto texto-suave" onClick={() => setHorario((x) => x.filter((_, j) => j !== i))}>Quitar</button>
              </div>
            ))}
            <button type="button" className="boton boton-chico" onClick={() => setHorario((x) => [...x, { dia: 1, desde: "09:00", hasta: "13:00" }])}>➕ Sumar franja</button>
          </fieldset>

          <label className="flex items-center gap-3">
            <input type="checkbox" className="size-5" data-mostrar-persona checked={mostrar} onChange={(e) => setMostrar(e.target.checked)} />
            <span>Mostrar a {persona.nombre} en la página y la app <span className="texto-suave text-sm">(si la opción general está prendida)</span></span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="boton boton-principal" disabled={ocupado} onClick={guardar}>{ocupado ? "Guardando…" : "Guardar"}</button>
            {mensaje && <p role={mensaje.tipo === "error" ? "alert" : "status"} className={`pildora ${mensaje.tipo === "error" ? "pildora-rojo" : "pildora-verde"}`}>{mensaje.tipo === "error" ? "⚠️ " : "✅ "}{mensaje.texto}</p>}
          </div>
        </div>
      )}
    </li>
  );
}
