"use client";
// Traer a un amigo (INV-1): nombre y DNI; la recepción lo hace pasar.
import { useState, useTransition } from "react";
import { invitarHoy } from "./acciones";
import { Icono } from "@/components/ui/Icono";

export type MisInvitados = { limite: number; usados: number; hoy: { nombre: string; entro: boolean }[] };

export function Invitar({ gimnasioId, socioId, datos }: { gimnasioId: string; socioId: string; datos: MisInvitados }) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (datos.limite === 0) return null;
  const quedan = Math.max(0, datos.limite - datos.usados);
  return (
    <section className="tarjeta p-5 space-y-3" data-invitar={quedan}>
      <p className="titulo text-2xl"><Icono nombre="usuarios" /> Traé a un amigo</p>
      <p className="texto-suave">{quedan > 0 ? `Te ${quedan === 1 ? "queda 1 invitación" : `quedan ${quedan} invitaciones`} este mes.` : "Ya usaste las invitaciones de este mes."}</p>
      {datos.hoy.length > 0 && <ul className="space-y-1">{datos.hoy.map((i) => <li key={i.nombre}>{i.entro ? <><Icono nombre="ok" /></> : <><Icono nombre="reloj-arena" /></>} {i.nombre}{i.entro ? " ya entró" : ": que diga tu nombre en recepción"}</li>)}</ul>}
      {quedan > 0 && (abierto ? (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await invitarHoy(gimnasioId, socioId, nombre, dni); if (r.error) setError(r.error); else { setError(null); setAbierto(false); setNombre(""); setDni(""); } }); }}>
          <input className="campo" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" aria-label="Nombre de tu invitado" required />
          <input className="campo" value={dni} onChange={(e) => setDni(e.target.value)} inputMode="numeric" placeholder="DNI" aria-label="DNI de tu invitado" required />
          <div className="flex gap-2">
            <button type="submit" className="boton" disabled={ocupado}>{ocupado ? "Invitando…" : "Invitar para hoy"}</button>
            <button type="button" className="boton" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </form>
      ) : <button type="button" className="boton" onClick={() => setAbierto(true)}><Icono nombre="mas" /> Invitar a alguien hoy</button>)}
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
    </section>
  );
}
