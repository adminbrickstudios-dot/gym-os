"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archivarRutina, guardarRutina, type ItemRutina } from "../acciones";
import { nombreGrupo, type Ejercicio } from "../tipos";
import { Icono } from "@/components/ui/Icono";

type Item = ItemRutina & { clave: number };
let siguiente = 1;

/** RUT-1: la rutina por días; cada día, sus ejercicios con series y repeticiones. */
export function Editor({ id, inicial, ejercicios }: { id: string | null; inicial: { nombre: string; descripcion: string; items: ItemRutina[] }; ejercicios: Ejercicio[] }) {
  const [nombre, setNombre] = useState(inicial.nombre);
  const [descripcion, setDescripcion] = useState(inicial.descripcion);
  const [items, setItems] = useState<Item[]>(inicial.items.map((x) => ({ ...x, clave: siguiente++ })));
  const [dias, setDias] = useState(Math.max(1, ...inicial.items.map((x) => x.dia)));
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const router = useRouter();
  const activos = ejercicios.filter((e) => e.activo);
  const cambiar = (clave: number, cambio: Partial<Item>) => setItems((xs) => xs.map((x) => (x.clave === clave ? { ...x, ...cambio } : x)));
  const sumar = (dia: number, ejercicio_id: string) => setItems((xs) => [...xs, { clave: siguiente++, dia, ejercicio_id, series: 3, repeticiones: "12" }]);
  const guardar = () => empezar(async () => {
    const orden = [...items].sort((a, b) => a.dia - b.dia || a.clave - b.clave).map((x) => ({ dia: x.dia, ejercicio_id: x.ejercicio_id, series: x.series, repeticiones: x.repeticiones, nota: x.nota ?? null }));
    const r = await guardarRutina(id, nombre, descripcion, orden);
    if (r.error) setError(r.error); else router.push("/panel/rutinas");
  });
  return (
    <div className="space-y-8" data-editor-rutina>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="space-y-1"><span className="etiqueta">Nombre</span><input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} placeholder="Fuerza 3 días" /></label>
        <label className="space-y-1"><span className="etiqueta">Para quién o para qué (opcional)</span><input className="campo" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={300} placeholder="Principiantes, hipertrofia…" /></label>
      </div>
      {Array.from({ length: dias }, (_, i) => i + 1).map((dia) => {
        const delDia = items.filter((x) => x.dia === dia);
        return (
          <section key={dia} className="tarjeta p-4 sm:p-5 space-y-3" data-dia={dia}>
            <h2 className="titulo text-2xl">Día {dia}</h2>
            {delDia.length === 0 && <p className="texto-suave text-sm">Sin ejercicios todavía.</p>}
            <ul className="space-y-2">{delDia.map((x) => {
              const e = ejercicios.find((y) => y.id === x.ejercicio_id);
              return (
                <li key={x.clave} className="grid grid-cols-[1fr_auto] sm:grid-cols-[1fr_5rem_6rem_1fr_auto] gap-2 items-center border-b border-[var(--borde)] pb-2">
                  <span className="min-w-0"><span className="block font-semibold truncate">{e?.nombre ?? "Ejercicio"}</span><span className="block text-xs texto-tenue">{e ? nombreGrupo(e.grupo) : ""}</span></span>
                  <button type="button" className="boton-texto texto-suave sm:order-last" aria-label={`Quitar ${e?.nombre ?? "ejercicio"}`} onClick={() => setItems((xs) => xs.filter((y) => y.clave !== x.clave))}>✕</button>
                  <label className="text-sm"><span className="sr-only">Series</span><input className="campo !min-h-11" type="number" min={1} max={20} value={x.series} onChange={(ev) => cambiar(x.clave, { series: Number(ev.target.value) })} aria-label="Series" /></label>
                  <label className="text-sm"><span className="sr-only">Repeticiones</span><input className="campo !min-h-11" value={x.repeticiones} maxLength={20} onChange={(ev) => cambiar(x.clave, { repeticiones: ev.target.value })} aria-label="Repeticiones" placeholder="12" /></label>
                  <input className="campo !min-h-11 col-span-2 sm:col-span-1" value={x.nota ?? ""} maxLength={120} onChange={(ev) => cambiar(x.clave, { nota: ev.target.value })} aria-label="Nota" placeholder="Nota (opcional)" />
                </li>
              );
            })}</ul>
            <label className="block"><span className="sr-only">Sumar ejercicio al día {dia}</span>
              <select className="campo" value="" onChange={(ev) => { if (ev.target.value) sumar(dia, ev.target.value); }} aria-label={`Sumar ejercicio al día ${dia}`}>
                <option value=""><Icono nombre="mas" /> Sumar ejercicio…</option>
                {activos.map((e) => <option key={e.id} value={e.id}>{e.nombre} · {nombreGrupo(e.grupo)}</option>)}
              </select></label>
          </section>
        );
      })}
      {dias < 7 && <button type="button" className="boton" onClick={() => setDias(dias + 1)}><Icono nombre="mas" /> Sumar día {dias + 1}</button>}
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="boton boton-principal" disabled={ocupado || items.length === 0 || nombre.trim().length < 2} onClick={guardar}>{ocupado ? "Guardando…" : "Guardar rutina"}</button>
        <Link href="/panel/rutinas" className="boton">Cancelar</Link>
        {id && <button type="button" className="boton texto-suave ml-auto" disabled={ocupado}
          onClick={() => empezar(async () => { const r = await archivarRutina(id); if (r.error) setError(r.error); else router.push("/panel/rutinas"); })}>Archivar</button>}
      </div>
    </div>
  );
}
