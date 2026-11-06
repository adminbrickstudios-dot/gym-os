"use client";
import { useMemo, useState, useTransition } from "react";
import { guardarEjercicio } from "./acciones";
import { EQUIPOS, GRUPOS, nombreEquipo, nombreGrupo, type Ejercicio } from "./tipos";

const sinTildes = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** RUT-1 + VD-20: la biblioteca de ejercicios del gimnasio, con buscador y filtros por grupo muscular y equipo. */
export function Ejercicios({ ejercicios }: { ejercicios: Ejercicio[] }) {
  const [nombre, setNombre] = useState("");
  const [grupo, setGrupo] = useState("piernas");
  const [equipo, setEquipo] = useState("otro");
  const [video, setVideo] = useState("");
  const [buscar, setBuscar] = useState("");
  const [fGrupo, setFGrupo] = useState("");
  const [fEquipo, setFEquipo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const activos = ejercicios.filter((e) => e.activo);
  const visibles = useMemo(() => {
    const q = sinTildes(buscar.trim());
    return activos.filter((e) => (!q || sinTildes(e.nombre).includes(q)) && (!fGrupo || e.grupo === fGrupo) && (!fEquipo || (e.equipo ?? "otro") === fEquipo));
  }, [activos, buscar, fGrupo, fEquipo]);
  const filtrando = buscar.trim() !== "" || fGrupo !== "" || fEquipo !== "";
  return (
    <section className="space-y-4" data-ejercicios>
      <h2 className="titulo text-3xl">🏋️ Ejercicios <span className="texto-tenue text-xl">{activos.length}</span></h2>
      <form className="tarjeta p-4 grid sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_1fr_auto] gap-3 items-end"
        onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await guardarEjercicio(null, nombre, grupo, video, true, equipo); if (r.error) setError(r.error); else { setError(null); setNombre(""); setVideo(""); } }); }}>
        <label className="space-y-1"><span className="etiqueta">Nombre</span><input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} required maxLength={80} placeholder="Sentadilla con barra" /></label>
        <label className="space-y-1"><span className="etiqueta">Grupo</span>
          <select className="campo" value={grupo} onChange={(e) => setGrupo(e.target.value)}>{GRUPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <label className="space-y-1"><span className="etiqueta">Equipo</span>
          <select className="campo" value={equipo} data-equipo onChange={(e) => setEquipo(e.target.value)}>{EQUIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
        <label className="space-y-1"><span className="etiqueta">Video (opcional)</span><input className="campo" value={video} onChange={(e) => setVideo(e.target.value)} placeholder="https://…" type="url" /></label>
        <button type="submit" className="boton" disabled={ocupado || nombre.trim().length < 2}>➕ Sumar</button>
      </form>
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
      {activos.length > 0 && (
        <div className="flex flex-wrap gap-2" data-filtros-ejercicios>
          <input className="campo flex-1 min-w-[12rem]" type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="🔍 Buscar ejercicio" aria-label="Buscar ejercicio" data-buscar-ejercicio />
          <select className="campo !w-auto" value={fGrupo} onChange={(e) => setFGrupo(e.target.value)} aria-label="Filtrar por grupo muscular"><option value="">Todos los grupos</option>{GRUPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          <select className="campo !w-auto" value={fEquipo} onChange={(e) => setFEquipo(e.target.value)} aria-label="Filtrar por equipo"><option value="">Todo el equipo</option>{EQUIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          {filtrando && <button type="button" className="boton-texto texto-suave" onClick={() => { setBuscar(""); setFGrupo(""); setFEquipo(""); }}>Limpiar</button>}
        </div>
      )}
      {activos.length === 0 ? <p className="texto-suave">Todavía no hay ejercicios. Sumá los que usan en el gimnasio y después armá las rutinas.</p>
        : visibles.length === 0 ? <p className="texto-suave" data-sin-resultados>Ningún ejercicio coincide con lo que buscás. Probá con otro nombre o limpiá los filtros.</p> : (
        <ul className="grid sm:grid-cols-2 gap-2" data-lista-ejercicios={visibles.length}>{visibles.map((e) => (
          <li key={e.id} className="tarjeta flex items-center gap-3 px-4 py-3 min-h-[56px]">
            <span className="flex-1 min-w-0"><span className="block font-semibold truncate">{e.nombre}</span><span className="block text-sm texto-suave">{nombreGrupo(e.grupo)} · {nombreEquipo(e.equipo)}</span></span>
            {e.video_url && <a href={e.video_url} target="_blank" rel="noopener noreferrer" className="boton boton-chico">▶️ Video</a>}
            <button type="button" className="boton-texto texto-suave text-sm" disabled={ocupado} aria-label={`Sacar ${e.nombre}`}
              onClick={() => empezar(async () => { const r = await guardarEjercicio(e.id, e.nombre, e.grupo, e.video_url ?? "", false, e.equipo ?? "otro"); setError(r.error ?? null); })}>Sacar</button>
          </li>
        ))}</ul>
      )}
    </section>
  );
}
