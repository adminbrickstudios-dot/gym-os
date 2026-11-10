"use client";
// VD-46N · Marca de “no escribirle”: no entra en avisos masivos (bandeja, Retención, cumpleaños, avisar a la clase)
// pero sigue en Vencen para cobrar. La recepción marca; sacar la marca es del dueño o el encargado.
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { marcarNoEscribirle } from "../moderacion-acciones";
import { Icono } from "@/components/ui/Icono";

export type DatosNoEscribirle = { marcado: boolean; desde: string | null; motivo: string | null; por: string | null; puede_sacar: boolean; veces_sacada: number | null };

export function NoEscribirle({ socioId, datos: d, zona }: { socioId: string; datos: DatosNoEscribirle; zona: string }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const f = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(m));
  const cerrar = () => { setAbierto(false); setMotivo(""); setError(null); };
  const guardar = async () => { const r = await marcarNoEscribirle(socioId, !d.marcado, motivo); if (r.error) setError(r.error); else cerrar(); };
  return (
    <div className="mt-4 space-y-2" data-no-escribirle={d.marcado ? "si" : "no"}>
      {d.marcado && (
        <Mensaje tipo="aviso">
          <p className="text-sm" data-no-escribirle-marca><Icono nombre="prohibido" /> <strong>No escribirle.</strong> {d.por ? `${d.por}, ` : ""}el {d.desde ? f(d.desde) : ""}: {d.motivo}. No sale en los avisos ni en los mensajes masivos; en Vencen para cobrar sí aparece.</p>
        </Mensaje>
      )}
      {!abierto ? (
        (!d.marcado || d.puede_sacar)
          ? <button type="button" className="boton boton-chico texto-suave" data-no-escribirle-abrir onClick={() => setAbierto(true)}>{d.marcado ? "Volver a escribirle" : "No escribirle"}</button>
          : <span className="texto-tenue text-sm">Sacar la marca lo hace el dueño o el encargado.</span>
      ) : (
        <div className="tarjeta p-4 space-y-3">
          <label className="block"><span className="font-semibold">{d.marcado ? "Por qué se vuelve a escribirle" : "Por qué no se le escribe"} (queda anotado con tu nombre)</span>
            <input className="campo mt-1" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)}
              placeholder={d.marcado ? "Ej.: pidió volver a recibir mensajes" : "Ej.: lo pidió en la recepción"} aria-label="Motivo" /></label>
          {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
          <div className="flex flex-wrap gap-2">
            <BotonAccion className="boton boton-principal" disabled={motivo.trim().length < 3} onClick={guardar}>{d.marcado ? "Volver a escribirle" : "No escribirle"}</BotonAccion>
            <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}
