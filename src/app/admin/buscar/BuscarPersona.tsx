"use client";
import Link from "next/link";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { buscarPersona, type PersonaEncontrada } from "../acciones";

const ROL: Record<string, string> = { socio: "Socio", dueno: "Dueño", encargado: "Encargado", recepcion: "Recepción", profe: "Profe" };

export function BuscarPersona() {
  const [q, setQ] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [personas, setPersonas] = useState<PersonaEncontrada[] | null>(null);
  return (
    <div className="space-y-4" data-buscar-persona>
      <div className="tarjeta p-4 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1"><span className="etiqueta">Mail, DNI o celular</span>
          <input className="campo" value={q} maxLength={120} onChange={(e) => setQ(e.target.value)} autoFocus /></label>
        <label className="space-y-1"><span className="etiqueta">Motivo (queda registrado)</span>
          <input className="campo" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} placeholder="Me escribió y no puede entrar" /></label>
        <div className="sm:col-span-2">
          <BotonAccion className="boton boton-principal" disabled={q.trim().length < 4 || motivo.trim().length < 5} onClick={async () => {
            const r = await buscarPersona(q, motivo);
            if (r.error) { setError(r.error); setPersonas(null); return; }
            setError(""); setPersonas(r.personas ?? []);
          }}>Buscar</BotonAccion>
        </div>
      </div>
      {error && <p role="alert" className="pildora pildora-rojo !rounded-2xl !px-4 !py-3">{error}</p>}
      {personas && personas.length === 0 && <p className="texto-suave" data-sin-resultados>No hay nadie con ese dato en ningún gimnasio.</p>}
      <ul className="space-y-2">
        {personas?.map((p) => (
          <li key={`${p.tipo}-${p.gimnasio_id}-${p.nombre}`} className="tarjeta p-4 flex flex-wrap items-center gap-3" data-persona>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{p.nombre}{p.baja && <span className="texto-tenue font-normal"> · dado de baja</span>}</span>
              <span className="block texto-suave text-sm">{ROL[p.rol] ?? p.rol} en {p.gimnasio}</span>
            </span>
            <Link href={`/admin/${p.gimnasio_id}`} className="boton">Abrir la ficha del gimnasio</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
