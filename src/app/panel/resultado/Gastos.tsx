"use client";
import { useState, useTransition } from "react";
import { formatearPesos } from "@/lib/formato";
import { agregarGasto, quitarGasto, repetirGastos } from "./acciones";

export type GastosMes = {
  mes: string; cobrado: number; total: number; ganancia: number; mes_anterior_tiene: boolean;
  gastos: { gasto_id: string; categoria: string; detalle: string | null; monto: number; por: string | null }[];
};
const CATEGORIAS: [string, string][] = [["alquiler", "🏠 Alquiler"], ["sueldos", "🧑‍🤝‍🧑 Sueldos"], ["servicios", "💡 Servicios"], ["otros", "📦 Otros"]];
const NOMBRE = Object.fromEntries(CATEGORIAS);

/** RES-3: gastos del mes y la ganancia (cobrado menos gastos). Solo el dueño. */
export function Gastos({ g }: { g: GastosMes }) {
  const [categoria, setCategoria] = useState("alquiler");
  const [detalle, setDetalle] = useState("");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const hacer = (f: () => Promise<{ error?: string }>, despues?: () => void) => empezar(async () => {
    setError(null); const r = await f(); if (r.error) setError(r.error); else despues?.();
  });
  const ganancia = Number(g.ganancia);
  return (
    <section aria-labelledby="ganancia" data-gastos>
      <h2 id="ganancia" className="titulo text-2xl mb-1">Gastos y ganancia</h2>
      <p className="texto-suave mb-4">Solo lo ves vos. Cobrado {formatearPesos(g.cobrado)} − gastos {formatearPesos(g.total)}:</p>
      <p className="numero text-5xl mb-6" data-ganancia style={{ color: ganancia < 0 ? "var(--rojo)" : undefined }}>
        {ganancia < 0 ? "−" : ""}{formatearPesos(Math.abs(ganancia))} <span className="texto-suave text-lg">{ganancia < 0 ? "de pérdida" : "de ganancia"}</span>
      </p>
      {g.gastos.length > 0 ? (
        <ul className="tarjeta divide-y divide-[var(--borde)] mb-4">
          {g.gastos.map((x) => (
            <li key={x.gasto_id} className="flex flex-wrap items-center gap-3 px-4 py-2 min-h-14">
              <span className="flex-1 min-w-0">{NOMBRE[x.categoria] ?? x.categoria}{x.detalle && <span className="texto-suave"> · {x.detalle}</span>}</span>
              <span className="numero">{formatearPesos(x.monto)}</span>
              <button type="button" className="boton-texto texto-suave" disabled={ocupado} aria-label={`Quitar ${x.detalle ?? x.categoria}`}
                onClick={() => hacer(() => quitarGasto(x.gasto_id))}>Quitar</button>
            </li>
          ))}
        </ul>
      ) : g.mes_anterior_tiene ? (
        <button type="button" className="boton mb-4" disabled={ocupado} onClick={() => hacer(() => repetirGastos(g.mes))}>🔁 Repetir los gastos del mes pasado</button>
      ) : <p className="texto-suave mb-4">Todavía no cargaste gastos de este mes.</p>}
      <form className="tarjeta p-4 grid gap-3 sm:grid-cols-[auto_1fr_10rem_auto] items-end"
        onSubmit={(e) => { e.preventDefault(); hacer(() => agregarGasto(g.mes, categoria, detalle, monto), () => { setDetalle(""); setMonto(""); }); }}>
        <label className="grid gap-1 text-sm">Qué es
          <select className="campo" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Detalle (opcional)
          <input className="campo" value={detalle} maxLength={120} onChange={(e) => setDetalle(e.target.value)} placeholder="Luz, sueldo de Ana…" />
        </label>
        <label className="grid gap-1 text-sm">Monto
          <input className="campo" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="250.000" required />
        </label>
        <button type="submit" className="boton" disabled={ocupado}>{ocupado ? "Guardando…" : "➕ Agregar"}</button>
      </form>
      {error && <p role="alert" className="pildora pildora-rojo mt-3">⚠️ {error}</p>}
    </section>
  );
}
