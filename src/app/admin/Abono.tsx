"use client";
import { Icono } from "@/components/ui/Icono";
import { useEffect, useState, useTransition } from "react";
import { formatearPesos } from "@/lib/formato";
import { anularPagoBrik, asignarPlanBrik, guardarPlanBrik, registrarPagoBrik } from "./acciones";

export type PlanBrik = { id: string; nombre: string; precio_mensual: number; activo: boolean; gimnasios: number };
export type EstadoAbono = { estado: "sin_abono" | "al_dia" | "por_vencer" | "vencido"; plan?: string; precio_mensual?: number; pagado_hasta?: string; dias?: number;
  plan_id: string | null; pagos: { id: string; monto: number; cubre_hasta: string; nota: string | null }[] };

const ESTADO: Record<EstadoAbono["estado"], [string, string]> = {
  sin_abono: ["Sin abono", ""], al_dia: ["Al día", "pildora-verde"], por_vencer: ["Por vencer", "pildora-amarillo"], vencido: ["Vencido: solo lectura", "pildora-rojo"],
};
const diaCorto = (d: string) => new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "numeric", year: "2-digit", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

export function PildoraAbono({ a }: { a: EstadoAbono | undefined }) {
  if (!a || a.estado === "sin_abono") return null;
  const [t, c] = ESTADO[a.estado];
  return <span className={`pildora ${c} align-middle`} data-abono={a.estado}>{t}{a.pagado_hasta ? ` · hasta ${diaCorto(a.pagado_hasta)}` : ""}</span>;
}

/** Los planes de BRIK: nombre y precio por mes (los carga Mateo; el código no inventa precios). */
export function PlanesBrik({ planes }: { planes: PlanBrik[] }) {
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-4" data-planes-brik>
      <p className="titulo text-2xl"><Icono nombre="tarjeta" /> Planes de Base</p>
      <p className="texto-suave">Lo que paga cada gimnasio por mes. Se asigna en el detalle de cada gimnasio.</p>
      {planes.length > 0 && <ul className="space-y-1">{planes.map((p) => (
        <li key={p.id} className={`flex items-center gap-3 ${p.activo ? "" : "opacity-50"}`}>
          <span className="flex-1">{p.nombre} · <span className="numero">{formatearPesos(p.precio_mensual)}</span>/mes · {p.gimnasios} gimnasios</span>
          <button type="button" className="boton-texto texto-suave text-sm" disabled={ocupado}
            onClick={() => empezar(async () => { const r = await guardarPlanBrik(p.id, p.nombre, p.precio_mensual, !p.activo); setError(r.error ?? null); })}>{p.activo ? "Apagar" : "Prender"}</button>
        </li>
      ))}</ul>}
      <form className="flex flex-wrap gap-3 items-end" onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await guardarPlanBrik(null, nombre, Number(precio.replace(/\./g, "").replace(",", "."))); if (r.error) setError(r.error); else { setError(null); setNombre(""); setPrecio(""); } }); }}>
        <label className="space-y-1"><span className="etiqueta">Nombre</span><input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Básico" /></label>
        <label className="space-y-1"><span className="etiqueta">Precio por mes ($)</span><input className="campo w-40" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} /></label>
        <button type="submit" className="boton" disabled={ocupado || nombre.trim().length < 2 || !precio}><Icono nombre="mas" /> Sumar plan</button>
      </form>
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
    </section>
  );
}

/** El abono de un gimnasio: su plan, los pagos que registra BRIK y hasta cuándo cubren. */
export function AbonoGimnasio({ gimnasioId, abono, planes }: { gimnasioId: string; abono: EstadoAbono; planes: PlanBrik[] }) {
  const [monto, setMonto] = useState(abono.precio_mensual ? String(abono.precio_mensual) : "");
  // Al asignar el plan después de abrir la página, el monto se completa con su precio.
  useEffect(() => { if (abono.precio_mensual) setMonto((m) => m || String(abono.precio_mensual)); }, [abono.precio_mensual]);
  const [hasta, setHasta] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const correr = (f: () => Promise<{ error?: string }>) => empezar(async () => { const r = await f(); setError(r.error ?? null); });
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-4" data-abono-gimnasio>
      <p className="titulo text-2xl"><Icono nombre="tarjeta" /> Abono de Base <PildoraAbono a={abono} /></p>
      <label className="block space-y-1 max-w-sm"><span className="etiqueta">Plan</span>
        <select className="campo" value={abono.plan_id ?? ""} disabled={ocupado} onChange={(e) => correr(() => asignarPlanBrik(gimnasioId, e.target.value || null))}>
          <option value="">Sin abono (no paga)</option>
          {planes.filter((p) => p.activo || p.id === abono.plan_id).map((p) => <option key={p.id} value={p.id}>{p.nombre} · {formatearPesos(p.precio_mensual)}/mes</option>)}
        </select>
        <span className="block text-sm texto-tenue">Al asignarlo tiene 14 días hasta el primer pago. Vencido, el panel queda en solo lectura (la puerta sigue).</span></label>
      {abono.plan_id && (
        <form className="flex flex-wrap gap-3 items-end" onSubmit={(e) => { e.preventDefault(); correr(() => registrarPagoBrik(gimnasioId, Number(monto.replace(/\./g, "").replace(",", ".")), hasta, nota)); }}>
          <label className="space-y-1"><span className="etiqueta">Pagó ($)</span><input className="campo w-36" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></label>
          <label className="space-y-1"><span className="etiqueta">Cubre hasta</span><input className="campo" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} required /></label>
          <label className="space-y-1 flex-1 min-w-40"><span className="etiqueta">Nota</span><input className="campo" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Transferencia del 5/11" maxLength={200} /></label>
          <button type="submit" className="boton" disabled={ocupado || !monto || !hasta}><Icono nombre="plata" /> Registrar pago</button>
        </form>
      )}
      {abono.pagos.length > 0 && <ul className="space-y-1 text-sm">{abono.pagos.map((p) => (
        <li key={p.id} className="flex items-center gap-3"><span className="flex-1">{formatearPesos(p.monto)} · cubre hasta {diaCorto(p.cubre_hasta)}{p.nota ? ` · ${p.nota}` : ""}</span>
          <button type="button" className="boton-texto texto-suave" disabled={ocupado} onClick={() => correr(() => anularPagoBrik(gimnasioId, p.id))}>Anular</button></li>
      ))}</ul>}
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
    </section>
  );
}
