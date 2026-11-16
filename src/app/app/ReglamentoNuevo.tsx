"use client";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { Icono } from "@/components/ui/Icono";
import { aceptarReglamento } from "./acciones";

/**
 * El dueño publicó una versión nueva del reglamento que este socio ya había aceptado: una sola tarjeta con el texto y "Acepto".
 * Hasta que acepte, ve la app igual: la puerta no cambia por esto (la decide calcular_acceso).
 */
export function ReglamentoNuevo({ socioId, version, texto }: { socioId: string; version: number; texto: string }) {
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (listo) return null;
  return (
    <section className="tarjeta p-5 space-y-3 border-2" style={{ borderColor: "var(--acento)" }} data-reglamento-nuevo={version}>
      <p className="titulo text-2xl"><Icono nombre="documento" /> El reglamento cambió</p>
      <div className="max-h-56 overflow-auto whitespace-pre-line texto-suave rounded-[var(--radio)] border border-[var(--borde)] p-3" data-reglamento-texto>{texto}</div>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      <button type="button" className="boton boton-principal text-lg px-8" disabled={ocupado} data-reglamento-acepto
        onClick={() => empezar(async () => { const r = await aceptarReglamento(socioId, version); if (r.error) setError(r.error); else setListo(true); })}>
        <Icono nombre="ok" /> {ocupado ? "Guardando…" : "Acepto"}
      </button>
    </section>
  );
}
