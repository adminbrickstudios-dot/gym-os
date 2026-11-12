"use client";
// Etiquetas del socio (arriba de la ficha) y sus notas con autor y fecha.
import { useState, useTransition } from "react";
import { AvisoSalud } from "@/components/ui/AvisoSalud";
import { detectarSalud } from "@/lib/salud";
import { agregarNota, borrarNota, ponerEtiqueta, sacarEtiqueta } from "../acciones";
import { Icono } from "@/components/ui/Icono";

export type Etiqueta = { id: string; nombre: string };
export type NotasYEtiquetas = { notas: { id: string; texto: string; creado_en: string; autor: string; puedo_borrar: boolean }[]; etiquetas: Etiqueta[]; todas: Etiqueta[] };

export function Etiquetas({ socioId, etiquetas, todas }: { socioId: string; etiquetas: Etiqueta[]; todas: Etiqueta[] }) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const poner = () => empezar(async () => { const r = await ponerEtiqueta(socioId, texto); setError(r.error ?? null); if (!r.error) setTexto(""); });
  return (
    <div className="flex flex-wrap items-center gap-2" data-etiquetas={etiquetas.length}>
      {etiquetas.map((e) => (
        <span key={e.id} className="pildora pildora-azul gap-1" data-etiqueta={e.nombre}>
          <Icono nombre="etiqueta" /> {e.nombre}
          <button type="button" aria-label={`Sacar la etiqueta ${e.nombre}`} disabled={ocupado} className="ml-1 opacity-70 hover:opacity-100"
            onClick={() => empezar(async () => { const r = await sacarEtiqueta(socioId, e.id); setError(r.error ?? null); })}><Icono nombre="cerrar" /></button>
        </span>
      ))}
      <form className="flex items-center gap-1" onSubmit={(ev) => { ev.preventDefault(); if (texto.trim()) poner(); }}>
        <input list={`etiquetas-${socioId}`} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={30}
          placeholder="+ etiqueta" aria-label="Nueva etiqueta" className="campo !min-h-9 !py-1 w-36 text-sm" />
        <datalist id={`etiquetas-${socioId}`}>{todas.filter((t) => !etiquetas.some((e) => e.id === t.id)).map((t) => <option key={t.id} value={t.nombre} />)}</datalist>
        {texto.trim() && <button type="submit" disabled={ocupado} className="boton !min-h-9 text-sm">Poner</button>}
      </form>
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
    </div>
  );
}

export function Notas({ socioId, notas, zona, notaVieja }: { socioId: string; notas: NotasYEtiquetas["notas"]; zona: string; notaVieja: string | null }) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const cuando = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "numeric", month: "numeric", year: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  return (
    <section className="space-y-4" data-notas={notas.length}>
      <form className="tarjeta p-5 space-y-3" onSubmit={(ev) => { ev.preventDefault(); empezar(async () => { const r = await agregarNota(socioId, texto); setError(r.error ?? null); if (!r.error) setTexto(""); }); }}>
        <label className="block space-y-1"><span className="etiqueta">Nueva nota</span>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={1000} className="campo min-h-24" placeholder="Prefiere el turno mañana, viene con la hermana…" /></label>
        <AvisoSalud texto={texto} />
        <p className="text-sm texto-tenue"><Icono nombre="corazon" /> No anotes datos de salud (lesiones, enfermedades): el sistema no los guarda.</p>
        {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
        <button type="submit" disabled={ocupado || !texto.trim() || !!detectarSalud(texto)} className="boton boton-principal">{ocupado ? "Guardando…" : "Guardar nota"}</button>
      </form>
      {notas.length === 0 && !notaVieja && <p className="texto-suave">Todavía no hay notas.</p>}
      <ul className="space-y-2">
        {notas.map((n) => (
          <li key={n.id} className="tarjeta p-4 space-y-1" data-nota>
            <p className="text-lg whitespace-pre-line">{n.texto}</p>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm texto-tenue">{n.autor} · {cuando(n.creado_en)}</p>
              {n.puedo_borrar && <button type="button" disabled={ocupado} className="text-sm texto-suave underline"
                onClick={() => empezar(async () => { const r = await borrarNota(socioId, n.id); setError(r.error ?? null); })}>Borrar</button>}
            </div>
          </li>
        ))}
        {notaVieja && <li className="tarjeta p-4 space-y-1"><p className="text-lg whitespace-pre-line">{notaVieja}</p><p className="text-sm texto-tenue">Nota de la ficha (se cambia en Editar)</p></li>}
      </ul>
    </section>
  );
}
