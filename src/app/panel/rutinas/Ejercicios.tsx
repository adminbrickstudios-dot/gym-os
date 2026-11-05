"use client";
import { useState, useTransition } from "react";
import { guardarEjercicio } from "./acciones";
import { GRUPOS, nombreGrupo, type Ejercicio } from "./tipos";

/** RUT-1: la biblioteca de ejercicios del gimnasio. */
export function Ejercicios({ ejercicios }: { ejercicios: Ejercicio[] }) {
  const [nombre, setNombre] = useState("");
  const [grupo, setGrupo] = useState("piernas");
  const [video, setVideo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const activos = ejercicios.filter((e) => e.activo);
  return (
    <section className="space-y-4" data-ejercicios>
      <h2 className="titulo text-3xl">🏋️ Ejercicios <span className="texto-tenue text-xl">{activos.length}</span></h2>
      <form className="tarjeta p-4 grid sm:grid-cols-[1fr_auto_1fr_auto] gap-3 items-end"
        onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await guardarEjercicio(null, nombre, grupo, video); if (r.error) setError(r.error); else { setError(null); setNombre(""); setVideo(""); } }); }}>
        <label className="space-y-1"><span className="etiqueta">Nombre</span><input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={80} placeholder="Sentadilla con barra" /></label>
        <label className="space-y-1"><span className="etiqueta">Grupo</span>
          <select className="campo" value={grupo} onChange={(e) => setGrupo(e.target.value)}>{GRUPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <label className="space-y-1"><span className="etiqueta">Video (opcional)</span><input className="campo" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://…" type="url" /></label>
        <button type="submit" className="boton" disabled={ocupado || nombre.trim().length < 2}>➕ Sumar</button>
      </form>
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
      {activos.length === 0 ? <p className="texto-suave">Todavía no hay ejercicios. Sumá los que usan en el gimnasio y después armá las rutinas.</p> : (
        <ul className="grid sm:grid-cols-2 gap-2">{activos.map((e) => (
          <li key={e.id} className="tarjeta flex items-center gap-3 px-4 py-3 min-h-[56px]">
            <span className="flex-1 min-w-0"><span className="block font-semibold truncate">{e.nombre}</span><span className="block text-sm texto-suave">{nombreGrupo(e.grupo)}</span></span>
            {e.video_url && <a href={e.video_url} target="_blank" rel="noopener noreferrer" className="boton boton-chico">▶️ Video</a>}
            <button type="button" className="boton-texto texto-suave text-sm" disabled={ocupado} aria-label={`Sacar ${e.nombre}`}
              onClick={() => empezar(async () => { const r = await guardarEjercicio(e.id, e.nombre, e.grupo, e.video_url ?? "", false); setError(r.error ?? null); })}>Sacar</button>
          </li>
        ))}</ul>
      )}
    </section>
  );
}
