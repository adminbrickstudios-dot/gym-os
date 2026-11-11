"use client";
// Llavero o tarjeta del socio (ENT-7): se pasa por el lector (escribe el código y Enter) o se tipea.
import { useState, useTransition } from "react";
import { asignarLlavero, quitarLlavero } from "../acciones";
import { Icono } from "@/components/ui/Icono";

export type DatosLlavero = { usa: boolean; llavero: string | null };

export function Llavero({ socioId, datos }: { socioId: string; datos: DatosLlavero }) {
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (!datos.usa) return null;
  const correr = (fn: () => Promise<{ error?: string }>) => empezar(async () => { const r = await fn(); if (r.error) setError(r.error); else { setError(null); setAbierto(false); setCodigo(""); } });
  return (
    <div className="space-y-2" data-llavero={datos.llavero ?? ""}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="pildora">{datos.llavero ? `Llavero ${datos.llavero}` : "Sin llavero"}</span>
        {!abierto && <button type="button" className="text-sm texto-suave underline" onClick={() => setAbierto(true)}>{datos.llavero ? "Cambiar" : "Asignar llavero"}</button>}
        {!abierto && datos.llavero && <button type="button" className="text-sm texto-tenue underline" disabled={ocupado} onClick={() => correr(() => quitarLlavero(socioId))}>Quitar</button>}
      </div>
      {abierto && (
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); correr(() => asignarLlavero(socioId, codigo)); }}>
          <input autoFocus className="campo flex-1 basis-48" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Pasá el llavero por el lector" aria-label="Código del llavero" />
          <button type="submit" className="boton boton-principal" disabled={ocupado || !codigo.trim()}>Guardar</button>
          <button type="button" className="boton" onClick={() => setAbierto(false)}>Cancelar</button>
        </form>
      )}
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
    </div>
  );
}
