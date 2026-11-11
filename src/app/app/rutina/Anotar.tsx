"use client";
import { useState, useTransition } from "react";
import { anotarEjercicio } from "../acciones";
import { Icono } from "@/components/ui/Icono";

/** RUT-2: anotar lo que levantó (kg) y las repeticiones; queda como "última". */
export function Anotar({ socioId, ejercicioId, nombre }: { socioId: string; ejercicioId: string; nombre: string }) {
  const [abierto, setAbierto] = useState(false);
  const [peso, setPeso] = useState("");
  const [reps, setReps] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (!abierto) return <button type="button" className="boton boton-chico" onClick={() => setAbierto(true)} aria-label={`Anotar ${nombre}`}><Icono nombre="lapiz" /> Anotar</button>;
  const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
  return (
    <form className="basis-full flex flex-wrap items-end gap-2" data-anotar
      onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await anotarEjercicio(socioId, ejercicioId, num(peso), num(reps)); if (r.error) setError(r.error); else { setAbierto(false); setPeso(""); setReps(""); setError(null); } }); }}>
      <label className="space-y-1"><span className="text-xs texto-suave">Kg</span><input className="campo !min-h-11 w-24" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} aria-label="Kilos" placeholder="60" /></label>
      <label className="space-y-1"><span className="text-xs texto-suave">Reps</span><input className="campo !min-h-11 w-20" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} aria-label="Repeticiones" placeholder="10" /></label>
      <button type="submit" className="boton !min-h-11" disabled={ocupado || (!peso && !reps)}>{ocupado ? "…" : "Guardar"}</button>
      <button type="button" className="boton-texto texto-suave" onClick={() => setAbierto(false)}>Cancelar</button>
      {error && <p role="alert" className="pildora pildora-rojo w-full"><Icono nombre="alerta" /> {error}</p>}
    </form>
  );
}
