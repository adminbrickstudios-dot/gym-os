"use client";
import { Icono } from "@/components/ui/Icono";
import { useState, useTransition } from "react";
import { publicarNovedadPara, retirarNovedadPlataforma } from "./acciones";

export type NovedadPlataforma = { id: string; titulo: string; texto: string; link: string | null; cerraron: number; alcanza?: number; para_plan?: string | null; para_ciudad?: string | null; para_modulo?: string | null };
const MODULOS: [string, string][] = [["", "Cualquiera"], ["clases", "Clases"], ["caja", "Caja"], ["vender", "Vender"], ["rutinas", "Rutinas"], ["retencion", "Retención"], ["transferencias", "Transferencias"], ["pt", "Turnos de entrenador"]];

/** ADM-6: lo que BRIK les cuenta a todos los dueños (aparece en su Inicio hasta que la cierran). */
export function NovedadesDuenos({ novedades }: { novedades: NovedadPlataforma[] }) {
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [link, setLink] = useState("");
  const [plan, setPlan] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [modulo, setModulo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-4" data-novedades-admin>
      <p className="titulo text-2xl"><Icono nombre="campana" /> Novedades para los dueños</p>
      <p className="texto-suave">Aparecen en el Inicio de cada dueño hasta que la cierra.</p>
      {novedades.length > 0 && <ul className="space-y-2">{novedades.map((n) => (
        <li key={n.id} className="flex flex-wrap items-center gap-3 rounded-[var(--radio)] border border-[var(--borde)] px-4 py-3">
          <span className="flex-1 min-w-0"><span className="block font-semibold">{n.titulo}</span><span className="block text-sm texto-suave">{n.texto} · le llega a {n.alcanza ?? "todos"} · la cerraron {n.cerraron}{n.para_plan || n.para_ciudad || n.para_modulo ? ` · solo ${[n.para_plan && `plan ${n.para_plan}`, n.para_ciudad, n.para_modulo && `con ${n.para_modulo}`].filter(Boolean).join(", ")}` : ""}</span></span>
          <button type="button" className="boton boton-chico texto-suave" disabled={ocupado}
            onClick={() => empezar(async () => { const r = await retirarNovedadPlataforma(n.id); setError(r.error ?? null); })}>Retirar</button>
        </li>
      ))}</ul>}
      <form className="grid sm:grid-cols-2 gap-3"
        onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await publicarNovedadPara(titulo, texto, link, plan, ciudad, modulo); if (r.error) setError(r.error); else { setError(null); setTitulo(""); setTexto(""); setLink(""); setPlan(""); setCiudad(""); setModulo(""); } }); }}>
        <label className="space-y-1"><span className="etiqueta">Título</span><input className="campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} placeholder="Ya podés cobrar con MercadoPago" /></label>
        <label className="space-y-1"><span className="etiqueta">Link (opcional)</span><input className="campo" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" type="url" /></label>
        <label className="space-y-1 sm:col-span-2"><span className="etiqueta">Texto</span><textarea className="campo" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={400} /></label>
        <label className="space-y-1"><span className="etiqueta">Solo al plan (opcional)</span><input className="campo" value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Básico" /></label>
        <label className="space-y-1"><span className="etiqueta">Solo a la ciudad (opcional)</span><input className="campo" value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Rosario" /></label>
        <label className="space-y-1"><span className="etiqueta">Solo a quienes tienen prendido</span><select className="campo" value={modulo} onChange={(e) => setModulo(e.target.value)}>{MODULOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select></label>
        <div className="sm:col-span-2"><button type="submit" className="boton" disabled={ocupado || titulo.trim().length < 3 || texto.trim().length < 3}><Icono nombre="campana" /> Publicar</button></div>
      </form>
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
    </section>
  );
}
