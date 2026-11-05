"use client";
import { useState, useTransition } from "react";
import { abonarTurno, quitarTurno } from "@/app/turnos-acciones";

export type Turno = { turno_id: string; horario_id: string; actividad: string; emoji: string | null; dia_semana: number; hora: string };
export type HorarioLibre = { horario_id: string; actividad: string; emoji: string | null; dia_semana: number; hora: string; sede: string; libres: number | null };
const DIA = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** CLA-2: los turnos fijos de un socio (en la app y en la ficha). Cada semana queda reservado solo, mientras pueda tomar la clase. */
export function TurnosFijos({ socioId, turnos, horarios, quien = "socio" }: { socioId: string; turnos: Turno[]; horarios: HorarioLibre[]; quien?: "socio" | "equipo" }) {
  const [elegido, setElegido] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const correr = (f: () => Promise<{ error?: string }>, despues?: () => void) => empezar(async () => { const x = await f(); setError(x.error ?? null); if (!x.error) despues?.(); });
  const disponibles = horarios.filter((h) => h.libres == null || h.libres > 0);
  return (
    <section className="tarjeta p-5 space-y-3" data-turnos-fijos>
      <p className="titulo text-xl">📌 {quien === "socio" ? "Mis turnos fijos" : "Turnos fijos"}</p>
      <p className="texto-suave text-[15px]">{quien === "socio" ? "Cada semana te queda reservado solo, mientras estés al día. Si una semana no podés, cancelá esa clase." : "Cada semana le queda reservado solo, mientras esté al día."}</p>
      {turnos.length > 0 && (
        <ul className="space-y-1">{turnos.map((t) => (
          <li key={t.turno_id} className="flex flex-wrap items-center gap-3 min-h-11">
            <span className="flex-1">{t.emoji ?? "🗓️"} {t.actividad} · {DIA[t.dia_semana]} {t.hora}</span>
            <button type="button" className="boton-texto texto-suave" disabled={ocupado} onClick={() => correr(() => quitarTurno(t.turno_id))}>Quitar</button>
          </li>
        ))}</ul>
      )}
      {disponibles.length > 0 ? (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (elegido) correr(() => abonarTurno(socioId, elegido), () => setElegido("")); }}>
          <select className="campo !w-auto flex-1 min-w-48" value={elegido} onChange={(e) => setElegido(e.target.value)} aria-label="Horario para el turno fijo">
            <option value="">Elegí un horario…</option>
            {disponibles.map((h) => <option key={h.horario_id} value={h.horario_id}>{h.emoji ?? ""} {h.actividad} · {DIA[h.dia_semana]} {h.hora}{h.libres != null ? ` · ${h.libres} libre${h.libres === 1 ? "" : "s"}` : ""}</option>)}
          </select>
          <button type="submit" className="boton" disabled={!elegido || ocupado}>{ocupado ? "Guardando…" : "📌 Dejarlo fijo"}</button>
        </form>
      ) : turnos.length === 0 && <p className="texto-suave">No quedan horarios con lugar fijo.</p>}
      {error && <p role="alert" className="pildora pildora-rojo">⚠️ {error}</p>}
    </section>
  );
}
