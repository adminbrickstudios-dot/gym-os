"use client";
import { useState, useTransition } from "react";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { Mensaje } from "@/components/ui/Mensaje";
import { formatearPesos } from "@/lib/formato";
import { cerrarEvento, crearEvento } from "./acciones";

export type Evento = { evento_id: string; producto_id: string; nombre: string; inicio: string; precio: number; descripcion: string | null; cupo: number;
  para: "todos" | "socios"; quedan: number; cerrado: boolean; zona: string; anotados: { nombre: string; cantidad: number; socio_id: string | null }[] };

/** Convierte "2026-11-20T19:00" (hora del gimnasio) a un instante, con el desfase de esa zona en ese momento. */
function aInstante(local: string, zona: string) {
  const guess = new Date(`${local}:00Z`);
  const enZona = new Date(guess.toLocaleString("en-US", { timeZone: zona }));
  const enUtc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (enZona.getTime() - enUtc.getTime())).toISOString();
}

export function NuevoEvento({ zona }: { zona: string }) {
  const [abierto, setAbierto] = useState(false);
  const [d, setD] = useState({ nombre: "", inicio: "", cupo: "20", precio: "", descripcion: "", para: "todos" });
  const [estado, setEstado] = useState<{ ok?: boolean; error?: string }>({});
  const [guardando, empezar] = useTransition();
  const set = (k: keyof typeof d, v: string) => setD((x) => ({ ...x, [k]: v }));
  if (!abierto) return <button type="button" className="boton boton-principal" onClick={() => setAbierto(true)}>➕ Nuevo evento</button>;
  return (
    <form className="tarjeta p-5 grid gap-3 sm:grid-cols-2" data-nuevo-evento
      onSubmit={(e) => { e.preventDefault(); empezar(async () => {
        if (!d.inicio) { setEstado({ error: "Elegí el día y la hora." }); return; }
        const precio = Number(d.precio.replace(/\./g, "").replace(",", ".") || "0");
        if (Number.isNaN(precio)) { setEstado({ error: "No entiendo el precio: escribilo como 15.000 (0 si es gratis)." }); return; }
        const r = await crearEvento({ nombre: d.nombre, inicio: aInstante(d.inicio, zona), cupo: Number(d.cupo), precio, descripcion: d.descripcion, para: d.para });
        setEstado(r.error ? { error: r.error } : { ok: true });
        if (!r.error) { setAbierto(false); setD({ nombre: "", inicio: "", cupo: "20", precio: "", descripcion: "", para: "todos" }); }
      }); }}>
      <label className="block space-y-1 sm:col-span-2"><span className="etiqueta">Nombre</span><input className="campo" maxLength={60} autoFocus value={d.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: Workshop de movilidad" /></label>
      <label className="block space-y-1"><span className="etiqueta">Día y hora</span><input className="campo" type="datetime-local" value={d.inicio} onChange={(e) => set("inicio", e.target.value)} /></label>
      <label className="block space-y-1"><span className="etiqueta">Cupo</span><input className="campo" inputMode="numeric" value={d.cupo} onChange={(e) => set("cupo", e.target.value.replace(/\D/g, ""))} /></label>
      <label className="block space-y-1"><span className="etiqueta">Precio</span><input className="campo" inputMode="decimal" value={d.precio} onChange={(e) => set("precio", e.target.value)} placeholder="0 si es gratis" /></label>
      <label className="block space-y-1"><span className="etiqueta">Para quién</span>
        <select className="campo" value={d.para} onChange={(e) => set("para", e.target.value)}><option value="todos">Para todos</option><option value="socios">Solo socios</option></select></label>
      <label className="block space-y-1 sm:col-span-2"><span className="etiqueta">Qué es (una línea)</span><input className="campo" maxLength={300} value={d.descripcion} onChange={(e) => set("descripcion", e.target.value)} /></label>
      {estado.error && <Mensaje tipo="error" className="sm:col-span-2">{estado.error}</Mensaje>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="submit" className="boton boton-principal" disabled={guardando || d.nombre.trim().length < 3}>{guardando ? "Creando…" : "✅ Crear evento"}</button>
        <button type="button" className="boton" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </form>
  );
}

export function FilaEvento({ e, puedeCerrar }: { e: Evento; puedeCerrar: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const cuando = new Intl.DateTimeFormat("es-AR", { timeZone: e.zona, weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(e.inicio));
  const pasado = new Date(e.inicio).getTime() < Date.now();
  return (
    <li className={`tarjeta p-5 space-y-3 ${e.cerrado ? "opacity-60" : ""}`} data-evento={e.cerrado ? "cerrado" : "abierto"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span><span className="titulo text-2xl">{e.nombre}</span> <span className="texto-suave first-letter:uppercase">· {cuando}</span></span>
        <span className="flex flex-wrap gap-2">
          <span className="pildora">{Number(e.precio) > 0 ? formatearPesos(e.precio) : "Gratis"}</span>
          <span className={`pildora ${e.quedan === 0 ? "pildora-rojo" : "pildora-verde"}`}>{e.anotados.length} de {e.cupo} · {e.quedan === 0 ? "lleno" : `quedan ${e.quedan}`}</span>
          {e.para === "socios" && <span className="pildora">Solo socios</span>}
        </span>
      </div>
      {e.descripcion && <p className="texto-suave">{e.descripcion}</p>}
      {e.anotados.length > 0 && (
        <details><summary className="cursor-pointer texto-suave">Anotados ({e.anotados.length})</summary>
          <ul className="mt-2 space-y-1 text-sm">{e.anotados.map((a, i) => <li key={i}>{a.socio_id ? <LinkPanel href={`/panel/socios/${a.socio_id}`} siNoEsta="texto" className="underline">{a.nombre}</LinkPanel> : a.nombre}{a.cantidad > 1 ? ` (${a.cantidad})` : ""}</li>)}</ul>
        </details>
      )}
      {!e.cerrado && (
        <div className="flex flex-wrap gap-2">
          {!pasado && e.quedan > 0 && <LinkPanel href="/panel/vender" className="boton">🛒 Vender un lugar</LinkPanel>}
          {puedeCerrar && <button type="button" className="boton texto-suave" disabled={ocupado}
            onClick={() => empezar(async () => { const r = await cerrarEvento(e.evento_id); setError(r.error ?? null); })}>{pasado ? "✅ Terminó: sacarlo de Vender" : "🚫 Cancelarlo (sale de Vender)"}</button>}
        </div>
      )}
      {error && <Mensaje tipo="error">{error}</Mensaje>}
    </li>
  );
}
