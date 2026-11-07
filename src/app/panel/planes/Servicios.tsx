"use client";
// VD-17 · Servicios adicionales (locker, toalla, nutrición…): se asignan al socio y se suman a su cuota
// todos los meses, en el mismo Cobrar. La plata la suma la base; acá se elige qué y a quién.
import { useEffect, useState, useTransition } from "react";
import { buscarSociosRapido, type ResultadoSocio } from "@/app/panel/acciones";
import { formatearPesos } from "@/lib/formato";
import { asignarServicio, guardarServicio, type Servicio } from "./acciones";

function FilaServicio({ s }: { s: Servicio }) {
  const [editando, setEditando] = useState(false);
  const [asignando, setAsignando] = useState(false);
  const [datos, setDatos] = useState({ nombre: s.nombre, precio: String(s.precio).replace(".", ",") });
  const [texto, setTexto] = useState("");
  const [hallados, setHallados] = useState<ResultadoSocio[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const correr = (f: () => Promise<{ error?: string }>, ok?: () => void) => empezar(async () => { const r = await f(); setError(r.error ?? null); if (!r.error) ok?.(); });
  useEffect(() => {
    if (!asignando || texto.trim().length < 2) { setHallados([]); return; }
    const t = setTimeout(async () => { const r = await buscarSociosRapido(texto.trim()); if (r.error) setError(r.error); else setHallados(r.socios ?? []); }, 150);
    return () => clearTimeout(t);
  }, [texto, asignando]);
  const ya = new Set(s.socios.map((x) => x.socio_id));
  return (
    <li className={`tarjeta px-4 py-3 ${s.activo ? "" : "opacity-55"}`} data-servicio={s.nombre}>
      {editando ? (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); correr(() => guardarServicio(s.producto_id, datos.nombre, datos.precio, s.activo), () => setEditando(false)); }}>
          <input autoFocus required aria-label="Nombre del servicio" className="campo !w-auto flex-1 min-w-32" value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
          <input required aria-label="Precio por mes" inputMode="decimal" className="campo !w-28" value={datos.precio} onChange={(e) => setDatos({ ...datos, precio: e.target.value })} />
          <button type="submit" className="boton boton-principal" disabled={ocupado}>Guardar</button>
          <button type="button" className="boton" onClick={() => setEditando(false)}>Cancelar</button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex-1 font-semibold min-w-0">{s.nombre}{!s.activo && <span className="texto-tenue font-normal text-sm"> · no se ofrece</span>}</span>
          <span className="numero text-xl">{formatearPesos(s.precio)}<span className="texto-tenue text-sm font-normal"> /mes</span></span>
          <span className="pildora text-sm" data-servicio-socios={s.socios.length}>{s.socios.length === 1 ? "1 socio" : `${s.socios.length} socios`}</span>
          <button type="button" className="boton-texto" onClick={() => setAsignando(!asignando)}>👤 Asignar</button>
          <button type="button" className="boton-texto" onClick={() => setEditando(true)}>✏️ Editar</button>
          <button type="button" className="boton-texto" disabled={ocupado} onClick={() => correr(() => guardarServicio(s.producto_id, s.nombre, s.precio, !s.activo))}>{s.activo ? "Dejar de ofrecer" : "Volver a ofrecer"}</button>
        </div>
      )}
      {s.socios.length > 0 && (
        <ul className="flex flex-wrap gap-2 mt-3">
          {s.socios.map((x) => (
            <li key={x.socio_id} className="pildora text-sm flex items-center gap-2" data-servicio-socio={x.nombre}>
              {x.nombre}
              <button type="button" className="boton-texto !min-h-0" aria-label={`Quitarle ${s.nombre} a ${x.nombre}`} disabled={ocupado} onClick={() => correr(() => asignarServicio(x.socio_id, s.producto_id, false))}>✕</button>
            </li>
          ))}
        </ul>
      )}
      {asignando && (
        <div className="mt-3 space-y-2">
          <input autoFocus className="campo" placeholder="🔍 Buscar el socio al que se lo cobrás" aria-label={`Buscar socio para ${s.nombre}`} value={texto} onChange={(e) => setTexto(e.target.value)} />
          {hallados.map((h) => (
            <button key={h.socio_id} type="button" className="fila gap-3" disabled={ocupado || ya.has(h.socio_id)}
              onClick={() => correr(() => asignarServicio(h.socio_id, s.producto_id, true), () => { setTexto(""); setHallados([]); setAsignando(false); })}>
              <span className="font-semibold flex-1 truncate text-left">{h.nombre}</span>
              <span className="texto-tenue text-sm">{ya.has(h.socio_id) ? "ya lo tiene" : "Asignar"}</span>
            </button>
          ))}
          {texto.trim().length >= 2 && hallados.length === 0 && <p className="texto-suave text-sm">No encuentro a nadie con ese nombre.</p>}
        </div>
      )}
      {error && <p role="alert" className="pildora pildora-rojo mt-2">⚠️ {error}</p>}
    </li>
  );
}

export function Servicios({ servicios }: { servicios: Servicio[] }) {
  const [nuevo, setNuevo] = useState({ nombre: "", precio: "" });
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <section data-servicios>
      <h2 className="titulo text-3xl mb-1">🔑 Servicios adicionales</h2>
      <p className="texto-suave mb-4">Locker, toalla, nutrición, lo que quieras: se le asigna a un socio y se suma a su cuota todos los meses. Se cobra en el mismo Cobrar.</p>
      {servicios.length === 0
        ? <p className="texto-tenue mb-4">Todavía no cargaste servicios. Ejemplo: Locker, $3.000 por mes. Agregá el primero acá abajo.</p>
        : <ul className="space-y-2 mb-4">{servicios.map((s) => <FilaServicio key={s.producto_id} s={s} />)}</ul>}
      <form className="flex flex-wrap gap-2" onSubmit={(e) => {
        e.preventDefault();
        empezar(async () => { const r = await guardarServicio(null, nuevo.nombre, nuevo.precio); setError(r.error ?? null); if (!r.error) setNuevo({ nombre: "", precio: "" }); });
      }}>
        <input className="campo !w-auto flex-1 min-w-40" aria-label="Servicio nuevo" placeholder="Servicio (ej: Locker)" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <input className="campo !w-32" inputMode="decimal" aria-label="Precio del servicio por mes" placeholder="$ por mes" value={nuevo.precio} onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })} />
        <button type="submit" className="boton" disabled={!nuevo.nombre.trim() || !nuevo.precio || ocupado}>➕ Agregar servicio</button>
      </form>
      {error && <p role="alert" className="pildora pildora-rojo mt-3">⚠️ {error}</p>}
    </section>
  );
}
