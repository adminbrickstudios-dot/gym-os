"use client";
// FA-9 · La lista de Socios con selección múltiple (WhatsApp, etiqueta, exportar) y columnas a elección.
// "Elegir varios" prende las casillas; con socios elegidos aparece la barra de acciones. Las columnas que se ven se recuerdan en este navegador.
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { PuntoEstado } from "@/components/panel/Estado";
import { Mensaje } from "@/components/ui/Mensaje";
import { aCsv } from "@/lib/csv";
import { etiquetarVarios, sociosSinMensajes } from "./acciones";

export type FilaSocio = { socio_id: string; numero: number; nombre: string; telefono: string | null; dni: string | null; plan: string | null; color: string; texto: string; dado_de_baja: boolean; puede?: boolean; autoalta?: boolean };
type Columna = "numero" | "plan" | "dni" | "telefono";
const COLUMNAS: [Columna, string][] = [["numero", "Número"], ["plan", "Plan"], ["dni", "DNI"], ["telefono", "Teléfono"]];
const CLAVE = "base.socios.columnas";
const POR_DEFECTO: Columna[] = ["numero", "plan"];
const soloDigitos = (t: string) => t.replace(/\D/g, "");

export function ListaSocios({ filas, etiquetas, puedeEtiquetar }: { filas: FilaSocio[]; etiquetas: { id: string; nombre: string }[]; puedeEtiquetar: boolean }) {
  const [varios, setVarios] = useState(false);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [columnas, setColumnas] = useState<Columna[]>(POR_DEFECTO);
  const [panel, setPanel] = useState<"whatsapp" | "etiqueta" | null>(null);
  const [mensaje, setMensaje] = useState("Hola {nombre}! ");
  const [sinMensajes, setSinMensajes] = useState<Set<string>>(new Set());
  const [etiqueta, setEtiqueta] = useState("");
  const [msj, setMsj] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [ocupado, empezar] = useTransition();

  useEffect(() => {
    try { const g = JSON.parse(localStorage.getItem(CLAVE) ?? "null"); if (Array.isArray(g)) setColumnas(g.filter((c): c is Columna => COLUMNAS.some(([k]) => k === c))); } catch { /* sin memoria: las de siempre */ }
  }, []);
  const guardarColumnas = (c: Columna[]) => { setColumnas(c); try { localStorage.setItem(CLAVE, JSON.stringify(c)); } catch { /* sin memoria */ } };
  const ver = (c: Columna) => columnas.includes(c);

  const marcados = useMemo(() => filas.filter((f) => elegidos.has(f.socio_id)), [filas, elegidos]);
  const alternar = (id: string) => setElegidos((a) => { const n = new Set(a); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const todos = filas.length > 0 && marcados.length === filas.length;
  const salir = () => { setVarios(false); setElegidos(new Set()); setPanel(null); setMsj(null); };

  const exportar = () => {
    const titulos = ["Nombre", ...COLUMNAS.filter(([k]) => ver(k)).map(([, t]) => t), "Estado"];
    const datos = marcados.map((f) => [f.nombre, ...COLUMNAS.filter(([k]) => ver(k)).map(([k]) => (k === "numero" ? f.numero : f[k] ?? "")), f.dado_de_baja ? "Dado de baja" : f.texto]);
    const url = URL.createObjectURL(new Blob([aCsv(titulos, datos)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "socios-elegidos.csv"; a.click(); URL.revokeObjectURL(url);
  };
  const abrirWhatsApp = () => {
    setPanel("whatsapp"); setMsj(null);
    empezar(async () => { const r = await sociosSinMensajes(marcados.map((f) => f.socio_id)); if (r.error) setMsj({ tipo: "error", texto: r.error }); else setSinMensajes(new Set(r.ids)); });
  };
  const aplicarEtiqueta = () => empezar(async () => {
    setMsj(null);
    const r = await etiquetarVarios(marcados.map((f) => f.socio_id), etiqueta);
    setMsj(r.error ? { tipo: "error", texto: r.error } : { tipo: "exito", texto: `Listo: “${etiqueta.trim()}” puesta a ${r.hechos} ${r.hechos === 1 ? "socio" : "socios"}.` });
  });

  const conTelefono = marcados.filter((f) => f.telefono && soloDigitos(f.telefono).length >= 8);
  const enviables = conTelefono.filter((f) => !sinMensajes.has(f.socio_id));

  return (
    <div data-lista-socios>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button type="button" className={`pestana ${varios ? "!bg-[var(--texto)] !text-[var(--fondo)]" : ""}`} aria-pressed={varios} data-elegir-varios onClick={() => (varios ? salir() : setVarios(true))}>{varios ? "Listo, dejar de elegir" : "Elegir varios"}</button>
        <details className="relative">
          <summary className="pestana cursor-pointer list-none" data-columnas-menu>Columnas</summary>
          <div className="tarjeta p-3 absolute z-20 mt-1 min-w-48 space-y-1">
            {COLUMNAS.map(([k, t]) => (
              <label key={k} className="flex items-center gap-2 min-h-9 cursor-pointer"><input type="checkbox" checked={ver(k)} onChange={(e) => guardarColumnas(e.target.checked ? [...columnas, k] : columnas.filter((c) => c !== k))} /> {t}</label>
            ))}
          </div>
        </details>
        {varios && <label className="flex items-center gap-2 min-h-11 cursor-pointer"><input type="checkbox" checked={todos} onChange={() => setElegidos(todos ? new Set() : new Set(filas.map((f) => f.socio_id)))} data-elegir-todos /> Elegir los {filas.length} de la lista</label>}
      </div>

      {varios && marcados.length > 0 && (
        <div className="tarjeta p-3 mb-3 space-y-3" data-barra-seleccion={marcados.length} role="region" aria-label="Acciones sobre los elegidos">
          <div className="flex flex-wrap items-center gap-2">
            <b>{marcados.length} {marcados.length === 1 ? "elegido" : "elegidos"}</b>
            <button type="button" className="boton" data-accion="whatsapp" onClick={abrirWhatsApp}>WhatsApp</button>
            {puedeEtiquetar && <button type="button" className="boton" data-accion="etiqueta" onClick={() => { setPanel("etiqueta"); setMsj(null); }}>Poner etiqueta</button>}
            <button type="button" className="boton" data-accion="exportar" onClick={exportar}>Exportar a Excel</button>
            <button type="button" className="boton-texto" onClick={() => setElegidos(new Set())}>Sacar la selección</button>
          </div>
          {msj && <Mensaje tipo={msj.tipo}>{msj.texto}</Mensaje>}
          {panel === "whatsapp" && (
            <div className="space-y-2" data-panel-whatsapp>
              <label className="grid gap-1"><span className="etiqueta">Mensaje (usá {"{nombre}"} para el primer nombre)</span>
                <textarea className="campo" rows={2} maxLength={500} value={mensaje} onChange={(e) => setMensaje(e.target.value)} /></label>
              <p className="texto-suave text-sm">{enviables.length} de {marcados.length} se pueden escribir
                {marcados.length - conTelefono.length > 0 && ` · ${marcados.length - conTelefono.length} sin teléfono`}
                {conTelefono.length - enviables.length > 0 && ` · ${conTelefono.length - enviables.length} con la marca “no escribirle” (no se les manda)`}. Cada botón abre el chat con el mensaje listo: lo mandás vos.</p>
              <ul className="grid gap-1 sm:grid-cols-2">{enviables.map((f) => (
                <li key={f.socio_id}><a className="boton w-full !justify-start" target="_blank" rel="noopener noreferrer" data-wa-socio
                  href={`https://wa.me/${soloDigitos(f.telefono!)}?text=${encodeURIComponent(mensaje.replaceAll("{nombre}", f.nombre.trim().split(/\s+/)[0] ?? ""))}`}>{f.nombre}</a></li>
              ))}</ul>
            </div>
          )}
          {panel === "etiqueta" && (
            <form className="flex flex-wrap items-end gap-2" data-panel-etiqueta onSubmit={(e) => { e.preventDefault(); if (etiqueta.trim()) aplicarEtiqueta(); }}>
              <label className="grid gap-1 flex-1 min-w-48"><span className="etiqueta">Etiqueta (elegí una o escribí una nueva)</span>
                <input className="campo" list="etiquetas-existentes" maxLength={40} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} /></label>
              <datalist id="etiquetas-existentes">{etiquetas.map((t) => <option key={t.id} value={t.nombre} />)}</datalist>
              <button type="submit" className="boton boton-principal" disabled={ocupado || !etiqueta.trim()}>{ocupado ? "Poniendo…" : `Ponérsela a ${marcados.length}`}</button>
            </form>
          )}
        </div>
      )}

      <ul className="space-y-2">
        {filas.map((s) => (
          <li key={s.socio_id} className="flex items-center gap-2">
            {varios && <input type="checkbox" className="size-5 flex-none" aria-label={`Elegir a ${s.nombre}`} checked={elegidos.has(s.socio_id)} onChange={() => alternar(s.socio_id)} data-elegir={s.socio_id} />}
            <Link href={`/panel/socios/${s.socio_id}`} className={`tarjeta flex flex-1 min-w-0 items-center gap-4 px-4 py-3 min-h-[68px] hover:bg-[var(--tarjeta-alta)] ${s.dado_de_baja ? "opacity-60" : ""}`}>
              <PuntoEstado color={s.color} grande />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-lg truncate">{s.nombre} {ver("numero") && <span className="texto-tenue font-normal">#{s.numero}</span>}</span>
                <span className="block texto-suave truncate">{s.dado_de_baja ? "Dado de baja" : s.texto}</span>
                {(ver("dni") || ver("telefono")) && <span className="block texto-tenue text-sm truncate">{[ver("dni") && s.dni ? `DNI ${s.dni}` : null, ver("telefono") ? s.telefono : null].filter(Boolean).join(" · ")}</span>}
              </span>
              {s.autoalta && <span className={`pildora flex-none ${s.puede !== false ? "" : "pildora-amarillo"}`} data-autoalta data-a-cobrar={s.puede === false ? "1" : undefined} title="Se registró solo desde la página">Web{s.puede === false && " A cobrar"}<span className="hidden sm:inline">{s.puede !== false ? " · se anotó por la web" : " · se anotó por la web"}</span></span>}
              {ver("plan") && s.plan && <span className="hidden sm:inline pildora">{s.plan}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
