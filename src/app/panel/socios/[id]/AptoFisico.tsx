"use client";
// Apto físico (D9): solo si lo presentó y hasta cuándo vale. Nada médico.
// Si el gimnasio no lo pide, no aparece.
import { useState, useTransition } from "react";
import { anularApto, cargarApto } from "../acciones";
import { Icono } from "@/components/ui/Icono";

export type DatosApto = { pide: false } | { pide: true; hoy: string; apto: { id: string; vence: string; vigente: boolean } | null };
const dia = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;
const enUnAnio = (d: string) => `${Number(d.slice(0, 4)) + 1}${d.slice(4)}`;

export function AptoFisico({ socioId, datos }: { socioId: string; datos: DatosApto }) {
  const [abierto, setAbierto] = useState(false);
  const [vence, setVence] = useState(datos.pide ? enUnAnio(datos.hoy) : "");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (!datos.pide) return null;
  const a = datos.apto;
  const pild = !a ? ["pildora-amarillo", "Sin apto físico"] : a.vigente ? ["pildora-verde", `Apto hasta el ${dia(a.vence)}`] : ["pildora-rojo", `Apto vencido el ${dia(a.vence)}`];
  const correr = (fn: () => Promise<{ error?: string }>) => empezar(async () => {
    const r = await fn(); if (r.error) { setError(r.error); return; } setError(null); setAbierto(false);
  });
  return (
    <div className="space-y-2" data-apto={!a ? "no" : a.vigente ? "vigente" : "vencido"}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`pildora ${pild[0]}`}>{pild[1]}</span>
        {!abierto && <button type="button" className="text-sm texto-suave underline" onClick={() => setAbierto(true)}>{a ? "Cargar uno nuevo" : "Cargar apto"}</button>}
        {!abierto && a && <button type="button" className="text-sm texto-tenue underline" disabled={ocupado} onClick={() => correr(() => anularApto(socioId, a.id))}>Fue un error, quitar</button>}
      </div>
      {abierto && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); correr(() => cargarApto(socioId, vence)); }}>
          <label className="space-y-1"><span className="block text-sm texto-suave">Presentó el apto. Vale hasta el</span>
            <input type="date" className="campo" value={vence} min={datos.hoy} onChange={(e) => setVence(e.target.value)} required aria-label="El apto vale hasta" /></label>
          <button type="submit" className="boton boton-principal" disabled={ocupado}>{ocupado ? "Guardando…" : "✓ Guardar"}</button>
          <button type="button" className="boton" onClick={() => setAbierto(false)}>Cancelar</button>
          <p className="basis-full text-sm texto-tenue">Solo se guarda que lo presentó y la fecha. El papel no se sube.</p>
        </form>
      )}
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
    </div>
  );
}
