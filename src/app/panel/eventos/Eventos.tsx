"use client";
import { useRef, useState, useTransition } from "react";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { Mensaje } from "@/components/ui/Mensaje";
import { formatearPesos } from "@/lib/formato";
import { urlFotoProducto } from "@/lib/url-producto";
import { cerrarEvento, crearEvento, marcarPresente, publicarEvento, subirFlyerEvento } from "./acciones";

export type Anotado = {
  clave: string; nombre: string; cantidad: number; socio_id: string | null; inscripcion_id: string | null; pago: boolean;
  telefono: string | null; dni: string | null; origen: string; precio: number | null; presente: boolean;
};
export type Espera = { clave: string; nombre: string; socio_id: string | null; inscripcion_id: string | null; telefono: string | null; dni: string | null; origen: string; posicion: number };
export type Evento = {
  evento_id: string; producto_id: string; nombre: string; inicio: string; fin: string | null; fechas: string[]; precio: number; precio_socio: number | null;
  descripcion: string | null; cupo: number; para: "todos" | "socios"; lugar: string | null; responsable: string | null; flyer: string | null; lista_espera: boolean;
  quedan: number; en_espera: number; cerrado: boolean; cerrado_motivo: "terminado" | "cancelado" | null; borrador: boolean; zona: string;
  anotados: Anotado[]; espera: Espera[]; asistieron: number;
};

/** Convierte "2026-11-20T19:00" (hora del gimnasio) a un instante, con el desfase de esa zona en ese momento. */
function aInstante(local: string, zona: string) {
  const guess = new Date(`${local}:00Z`);
  const enZona = new Date(guess.toLocaleString("en-US", { timeZone: zona }));
  const enUtc = new Date(guess.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(guess.getTime() - (enZona.getTime() - enUtc.getTime())).toISOString();
}
const numero = (t: string) => Number(t.replace(/\./g, "").replace(",", ".") || "0");
const diaLocal = (iso: string | number | Date, zona: string) => new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date(iso));
const cuandoLargo = (iso: string, zona: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
const cuandoCorto = (iso: string, zona: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

const VACIO = { nombre: "", inicio: "", fin: "", cupo: "20", precio: "", precioSocio: "", descripcion: "", para: "todos", lugar: "", responsable: "", espera: true };

export function NuevoEvento({ zona }: { zona: string }) {
  const [abierto, setAbierto] = useState(false);
  const [d, setD] = useState(VACIO);
  const [extras, setExtras] = useState<string[]>([]);
  const [estado, setEstado] = useState<{ error?: string }>({});
  const [guardando, empezar] = useTransition();
  const archivo = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof VACIO>(k: K, v: (typeof VACIO)[K]) => setD((x) => ({ ...x, [k]: v }));
  if (!abierto) return <button type="button" className="boton boton-principal" onClick={() => setAbierto(true)}>➕ Nuevo evento</button>;

  const guardar = (borrador: boolean) => empezar(async () => {
    if (!d.inicio) { setEstado({ error: "Elegí el día y la hora." }); return; }
    const precio = numero(d.precio);
    const precioSocio = d.precioSocio.trim() ? numero(d.precioSocio) : null;
    if (Number.isNaN(precio) || (precioSocio !== null && Number.isNaN(precioSocio))) { setEstado({ error: "No entiendo el precio: escribilo como 15.000 (0 si es gratis)." }); return; }
    const r = await crearEvento({
      nombre: d.nombre, inicio: aInstante(d.inicio, zona), cupo: Number(d.cupo), precio, descripcion: d.descripcion, para: d.para,
      fin: d.fin ? aInstante(d.fin, zona) : null, fechasExtra: extras.filter(Boolean).map((x) => aInstante(x, zona)), lugar: d.lugar, responsable: d.responsable,
      precioSocio, borrador, listaEspera: d.espera,
    });
    if (r.error || !r.id) { setEstado({ error: r.error ?? "No se pudo crear el evento." }); return; }
    const f = archivo.current?.files?.[0];
    if (f) {
      const fd = new FormData(); fd.set("flyer", f);
      const s = await subirFlyerEvento(r.id, fd);
      if (s.error) { setEstado({ error: `El evento se creó, pero el flyer no: ${s.error}` }); }
    }
    setEstado({}); setAbierto(false); setD(VACIO); setExtras([]);
  });

  return (
    <form className="tarjeta p-5 grid gap-3 sm:grid-cols-2" data-nuevo-evento onSubmit={(e) => { e.preventDefault(); guardar(false); }}>
      <label className="block space-y-1 sm:col-span-2"><span className="etiqueta">Nombre</span><input className="campo" maxLength={60} autoFocus value={d.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej: Workshop de movilidad" /></label>
      <label className="block space-y-1"><span className="etiqueta">Día y hora</span><input className="campo" type="datetime-local" value={d.inicio} onChange={(e) => set("inicio", e.target.value)} /></label>
      <label className="block space-y-1"><span className="etiqueta">Cupo</span><input className="campo" inputMode="numeric" value={d.cupo} onChange={(e) => set("cupo", e.target.value.replace(/\D/g, ""))} /></label>
      <label className="block space-y-1"><span className="etiqueta">Precio general (no socio)</span><input className="campo" inputMode="decimal" value={d.precio} onChange={(e) => set("precio", e.target.value)} placeholder="0 si es gratis" /></label>
      <label className="block space-y-1"><span className="etiqueta">Precio de socio (opcional)</span><input className="campo" inputMode="decimal" data-precio-socio value={d.precioSocio} onChange={(e) => set("precioSocio", e.target.value)} placeholder="igual al general" /></label>
      <label className="block space-y-1"><span className="etiqueta">Termina (opcional)</span><input className="campo" type="datetime-local" value={d.fin} onChange={(e) => set("fin", e.target.value)} /></label>
      <label className="block space-y-1"><span className="etiqueta">Para quién</span>
        <select className="campo" value={d.para} onChange={(e) => set("para", e.target.value)}><option value="todos">Para todos</option><option value="socios">Solo socios</option></select></label>
      <label className="block space-y-1"><span className="etiqueta">Lugar (sede o dirección)</span><input className="campo" maxLength={120} value={d.lugar} onChange={(e) => set("lugar", e.target.value)} /></label>
      <label className="block space-y-1"><span className="etiqueta">Profe o responsable</span><input className="campo" maxLength={80} value={d.responsable} onChange={(e) => set("responsable", e.target.value)} /></label>
      <label className="block space-y-1 sm:col-span-2"><span className="etiqueta">Qué es (una línea)</span><input className="campo" maxLength={300} value={d.descripcion} onChange={(e) => set("descripcion", e.target.value)} /></label>

      <div className="sm:col-span-2 space-y-2" data-fechas-extra>
        <span className="etiqueta block">Otras fechas (si es un ciclo)</span>
        {extras.map((x, i) => (
          <div key={i} className="flex gap-2">
            <input className="campo" type="datetime-local" aria-label={`Fecha ${i + 2}`} value={x} onChange={(e) => setExtras((l) => l.map((y, j) => (j === i ? e.target.value : y)))} />
            <button type="button" className="boton" aria-label="Sacar esta fecha" onClick={() => setExtras((l) => l.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        {extras.length < 20 && <button type="button" className="boton" data-otra-fecha onClick={() => setExtras((l) => [...l, ""])}>➕ Otra fecha</button>}
      </div>

      <label className="block space-y-1 sm:col-span-2"><span className="etiqueta">Flyer o foto (opcional)</span>
        <input ref={archivo} className="campo" type="file" accept="image/jpeg,image/png,image/webp" data-flyer /></label>
      <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={d.espera} onChange={(e) => set("espera", e.target.checked)} /> <span>Si se llena, anotar en una lista de espera</span></label>

      {estado.error && <Mensaje tipo="error" className="sm:col-span-2">{estado.error}</Mensaje>}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" className="boton boton-principal" disabled={guardando || d.nombre.trim().length < 3}>{guardando ? "Creando…" : "✅ Crear evento"}</button>
        <button type="button" className="boton" disabled={guardando || d.nombre.trim().length < 3} onClick={() => guardar(true)}>📝 Guardar como borrador</button>
        <button type="button" className="boton-texto px-3" onClick={() => setAbierto(false)}>Cancelar</button>
      </div>
    </form>
  );
}

function descargarCsv(e: Evento) {
  const celda = (t: unknown) => `"${String(t ?? "").replace(/"/g, '""')}"`;
  const filas = [["Nombre", "DNI", "Teléfono", "Lugar", "Pagó", "Presente", "Cómo se anotó"],
    ...e.anotados.map((a) => [a.nombre, a.dni, a.telefono, "Anotado", a.pago ? "Sí" : "No", a.presente ? "Sí" : "No", a.origen]),
    ...e.espera.map((a) => [a.nombre, a.dni, a.telefono, `Espera #${a.posicion}`, "No", "No", a.origen])];
  const blob = new Blob(["﻿" + filas.map((f) => f.map(celda).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `${e.nombre.replace(/[^\p{L}\p{N}]+/gu, "-")}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const whatsapp = (tel: string | null) => (tel ? `https://wa.me/${tel.replace(/\D/g, "")}` : null);

export function FilaEvento({ e, puedeCerrar }: { e: Evento; puedeCerrar: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const archivo = useRef<HTMLInputElement>(null);
  const ultima = e.fechas[e.fechas.length - 1] ?? e.inicio;
  const pasado = new Date(ultima).getTime() < Date.now();
  const hoyEsDia = !e.cerrado && !e.borrador && e.fechas.some((f) => diaLocal(f, e.zona) === diaLocal(Date.now(), e.zona));
  const ocupados = e.anotados.reduce((n, a) => n + a.cantidad, 0);
  const flyer = urlFotoProducto(e.flyer);
  const accion = (fn: () => Promise<{ error?: string }>) => empezar(async () => { const r = await fn(); setError(r.error ?? null); });
  const estado = e.cerrado ? (e.cerrado_motivo === "cancelado" ? "Cancelado" : "Terminado") : e.borrador ? "Borrador" : e.quedan === 0 ? "Lleno" : "Publicado";
  return (
    <li className={`tarjeta p-5 space-y-3 ${e.cerrado ? "opacity-70" : ""}`} data-evento={e.cerrado ? "cerrado" : "abierto"} data-estado-evento={estado.toLowerCase()}>
      <div className="flex flex-col gap-4 sm:flex-row">
        {flyer && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flyer} alt={`Flyer de ${e.nombre}`} data-flyer-evento className="w-full max-h-64 sm:w-40 sm:max-h-none rounded-[var(--radio)] object-cover flex-none" />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="min-w-0"><span className="titulo text-2xl break-words">{e.nombre}</span> <span className="texto-suave first-letter:uppercase">· {cuandoLargo(e.inicio, e.zona)}</span></span>
            <span className="flex flex-wrap gap-2">
              <span className="pildora">{estado}</span>
              <span className="pildora">{Number(e.precio) > 0
                ? (e.precio_socio !== null ? `Socio ${formatearPesos(e.precio_socio)} · No socio ${formatearPesos(e.precio)}` : formatearPesos(e.precio)) : "Gratis"}</span>
              <span className={`pildora ${e.quedan === 0 ? "pildora-rojo" : "pildora-verde"}`}>{ocupados} de {e.cupo} · {e.quedan === 0 ? "lleno" : `quedan ${e.quedan}`}</span>
              {e.en_espera > 0 && <span className="pildora pildora-amarillo" data-en-espera={e.en_espera}>{e.en_espera} en espera</span>}
              {e.para === "socios" && <span className="pildora">Solo socios</span>}
            </span>
          </div>
          {(e.lugar || e.responsable) && <p className="texto-suave">{[e.lugar && `📍 ${e.lugar}`, e.responsable && `👤 ${e.responsable}`].filter(Boolean).join(" · ")}</p>}
          {e.fechas.length > 1 && (
            <p className="texto-suave" data-fechas-evento>🗓️ {e.fechas.length} fechas: {e.fechas.map((f) => cuandoCorto(f, e.zona)).join(" · ")}</p>
          )}
          {e.descripcion && <p className="texto-suave">{e.descripcion}</p>}
        </div>
      </div>

      {e.cerrado && (
        <p className="font-semibold" data-resumen-evento>
          {e.cerrado_motivo === "cancelado" ? "Se canceló." : "Terminó."} Asistieron {e.asistieron} de {ocupados} anotados.
        </p>
      )}

      {e.anotados.length > 0 && (
        <details open={hoyEsDia}><summary className="cursor-pointer texto-suave">Anotados ({ocupados}){e.asistieron > 0 ? ` · ${e.asistieron} presentes` : ""}</summary>
          <ul className="mt-2 space-y-2 text-sm" data-lista-anotados>
            {e.anotados.map((a) => {
              const wa = whatsapp(a.telefono);
              return (
                <li key={a.clave} className="flex flex-wrap items-center gap-2" data-anotado={a.nombre}>
                  <span className="min-w-0 break-words">{a.socio_id ? <LinkPanel href={`/panel/socios/${a.socio_id}`} siNoEsta="texto" className="underline">{a.nombre}</LinkPanel> : a.nombre}{a.cantidad > 1 ? ` (${a.cantidad})` : ""}</span>
                  {a.pago ? <span className="pildora pildora-verde">Pagó</span> : <span className="pildora pildora-amarillo">Falta pagar{a.precio ? ` ${formatearPesos(a.precio)}` : ""}</span>}
                  {a.origen !== "recepcion" && <span className="pildora">{a.origen === "app" ? "Por la app" : "Por la página"}</span>}
                  {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="boton-texto px-2" aria-label={`WhatsApp a ${a.nombre}`}>💬</a>}
                  {hoyEsDia && (a.socio_id || a.inscripcion_id) && (
                    a.presente
                      ? <button type="button" className="boton" disabled={ocupado} data-presente="si" onClick={() => accion(() => marcarPresente(e.evento_id, { socioId: a.socio_id, inscripcionId: a.inscripcion_id }, true))}>✓ Presente (deshacer)</button>
                      : <button type="button" className="boton" disabled={ocupado} data-marcar-presente onClick={() => accion(() => marcarPresente(e.evento_id, { socioId: a.socio_id, inscripcionId: a.inscripcion_id }))}>Marcar presente</button>
                  )}
                  {!hoyEsDia && a.presente && <span className="pildora pildora-verde">Estuvo</span>}
                </li>
              );
            })}
          </ul>
        </details>
      )}
      {e.espera.length > 0 && (
        <details><summary className="cursor-pointer texto-suave">Lista de espera ({e.espera.length})</summary>
          <ol className="mt-2 space-y-1 text-sm" data-lista-espera>
            {e.espera.map((w) => <li key={w.clave}>#{w.posicion} · {w.nombre}{w.telefono ? ` · ${w.telefono}` : ""}</li>)}
          </ol>
        </details>
      )}

      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <div className="flex flex-wrap gap-2">
        {!e.cerrado && !e.borrador && !pasado && e.quedan > 0 && <LinkPanel href="/panel/vender" className="boton">🛒 Vender un lugar</LinkPanel>}
        {puedeCerrar && !e.cerrado && e.borrador && <button type="button" className="boton boton-principal" disabled={ocupado} data-publicar onClick={() => accion(() => publicarEvento(e.evento_id))}>📢 Publicar</button>}
        {puedeCerrar && !e.cerrado && (
          <>
            <button type="button" className="boton" disabled={ocupado} onClick={() => archivo.current?.click()}>{flyer ? "🖼️ Cambiar flyer" : "🖼️ Subir flyer"}</button>
            <input ref={archivo} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" data-flyer-fila
              onChange={(ev) => { const f = ev.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.set("flyer", f); accion(() => subirFlyerEvento(e.evento_id, fd)); ev.target.value = ""; }} />
          </>
        )}
        {(e.anotados.length > 0 || e.espera.length > 0) && <button type="button" className="boton" onClick={() => descargarCsv(e)}>⬇️ Exportar anotados</button>}
        {puedeCerrar && !e.cerrado && <button type="button" className="boton texto-suave" disabled={ocupado} data-cerrar-evento
          onClick={() => accion(() => cerrarEvento(e.evento_id))}>{pasado || e.asistieron > 0 ? "✅ Terminó: cerrarlo y sacarlo de Vender" : "🚫 Cancelarlo (sale de Vender)"}</button>}
      </div>
    </li>
  );
}
