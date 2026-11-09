"use client";
import Link from "next/link";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { borrarSocio, buscarPersona, type PersonaEncontrada } from "../acciones";

const ROL: Record<string, string> = { socio: "Socio", dueno: "Dueño", encargado: "Encargado", recepcion: "Recepción", profe: "Profe" };

/** SA-5 y SA-11: buscar a una persona; si es socio, exportar o borrar sus datos (solo el principal; la base lo valida). */
export function BuscarPersona() {
  const [q, setQ] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
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
            setAviso("");
            if (r.error) { setError(r.error); setPersonas(null); return; }
            setError(""); setPersonas(r.personas ?? []);
          }}>Buscar</BotonAccion>
        </div>
      </div>
      {error && <p role="alert" className="pildora pildora-rojo !rounded-2xl !px-4 !py-3">{error}</p>}
      {aviso && <p className="texto-suave" role="status">{aviso}</p>}
      {personas && personas.length === 0 && <p className="texto-suave" data-sin-resultados>No hay nadie con ese dato en ningún gimnasio.</p>}
      <ul className="space-y-2">
        {personas?.map((p) => (
          <li key={`${p.tipo}-${p.gimnasio_id}-${p.nombre}`} className="tarjeta p-4 space-y-2" data-persona>
            <div className="flex flex-wrap items-center gap-3">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{p.nombre}{p.baja && <span className="texto-tenue font-normal"> · dado de baja</span>}</span>
                <span className="block texto-suave text-sm">{ROL[p.rol] ?? p.rol} en {p.gimnasio}</span>
              </span>
              <Link href={`/admin/${p.gimnasio_id}`} className="boton">Abrir la ficha del gimnasio</Link>
            </div>
            {p.tipo === "socio" && p.persona_id && (
              <div className="flex flex-wrap gap-2" data-datos-personales>
                <a className="boton" href={`/admin/buscar/exportar-socio?gimnasio=${p.gimnasio_id}&socio=${p.persona_id}`}>Exportar sus datos</a>
                <BotonAccion className="boton texto-suave" ocupadoTexto="Borrando…" onClick={async () => {
                  const why = window.prompt(`Se borran los datos personales de ${p.nombre}. Los pagos se conservan con el nombre tachado. ¿Por qué? (por ejemplo, "lo pidió el socio")`);
                  if (!why || !window.confirm("Esto no se puede deshacer. ¿Borrar los datos?")) return;
                  const r = await borrarSocio(p.gimnasio_id, p.persona_id!, why);
                  if (r.error) { setError(r.error); return; }
                  setError(""); setAviso(`Datos de ${p.nombre} borrados.`);
                  setPersonas((l) => l?.filter((x) => x.persona_id !== p.persona_id) ?? null);
                }}>Borrar sus datos</BotonAccion>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
