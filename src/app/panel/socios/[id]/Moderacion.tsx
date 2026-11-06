"use client";
// VD-46B · Suspender o expulsar desde la ficha. Recepción suspende; expulsar y levantar es del dueño o el encargado.
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { levantarSuspension, revisarSuspension, suspenderSocio } from "../moderacion-acciones";

export type DatosSuspension = {
  vigente: { id: string; tipo: "suspension" | "expulsion"; motivo: string; desde: string; hasta: string | null; revisar_en: string | null; por: string | null; revision_vencida: boolean } | null;
  historial: { id: string; tipo: string; motivo: string; desde: string; hasta: string | null; levantada_en: string | null; levantada_motivo: string | null; por: string | null }[];
  puede_suspender: boolean; puede_expulsar: boolean; puede_levantar: boolean;
};

const sumar = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const fecha = (m: string, zona: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(m));

export function Suspension({ socioId, datos: d, zona, hoy }: { socioId: string; datos: DatosSuspension; zona: string; hoy: string }) {
  const [abierto, setAbierto] = useState<null | "suspender" | "levantar" | "revisar">(null);
  const [tipo, setTipo] = useState<"suspension" | "expulsion">("suspension");
  const [motivo, setMotivo] = useState("");
  const [hasta, setHasta] = useState("");
  const [revisar, setRevisar] = useState(sumar(hoy, 30));
  const [error, setError] = useState<string | null>(null);
  const cerrar = () => { setAbierto(null); setMotivo(""); setHasta(""); setError(null); };
  const correr = async (fn: () => Promise<{ error?: string }>) => { const r = await fn(); if (r.error) setError(r.error); else cerrar(); };

  if (d.vigente) {
    const v = d.vigente;
    const nombre = v.tipo === "expulsion" ? "Expulsado" : "Suspendido";
    return (
      <div className="mt-4 space-y-3" data-suspension={v.tipo}>
        <Mensaje tipo="error">
          <p><strong>🚫 {nombre}</strong> desde el {fecha(v.desde, zona)}{v.por ? ` · lo cargó ${v.por}` : ""}{v.hasta ? ` · hasta el ${fecha(v.hasta, zona)}` : ""}</p>
          <p className="break-words">{v.motivo}</p>
          {v.revisar_en && <p className={`text-sm ${v.revision_vencida ? "font-semibold" : "texto-suave"}`}>{v.revision_vencida ? "⏰ Toca revisarla" : "Se revisa"} el {fecha(v.revisar_en, zona)}</p>}
          <p className="texto-suave text-sm">No entra por la puerta, ni con QR, ni como invitado.</p>
        </Mensaje>
        {d.puede_levantar ? (
          abierto === "levantar" ? (
            <div className="tarjeta p-4 space-y-3" data-levantar>
              <label className="block"><span className="font-semibold">¿Por qué se levanta?</span>
                <input className="campo mt-1" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} placeholder="Ej.: pidió disculpas y se habló" /></label>
              {error && <p role="alert" className="pildora pildora-rojo whitespace-normal">⚠️ {error}</p>}
              <div className="flex flex-wrap gap-2">
                <BotonAccion className="boton boton-principal" disabled={motivo.trim().length < 3} onClick={() => correr(() => levantarSuspension(socioId, v.id, motivo))}>✅ Levantar</BotonAccion>
                <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
              </div>
            </div>
          ) : abierto === "revisar" ? (
            <div className="tarjeta p-4 space-y-3" data-revisar>
              <label className="block"><span className="font-semibold">La revisé y sigue: próxima revisión</span>
                <input type="date" className="campo mt-1" value={revisar} min={sumar(hoy, 1)} onChange={(e) => setRevisar(e.target.value)} /></label>
              {error && <p role="alert" className="pildora pildora-rojo whitespace-normal">⚠️ {error}</p>}
              <div className="flex flex-wrap gap-2">
                <BotonAccion className="boton boton-principal" onClick={() => correr(() => revisarSuspension(socioId, v.id, revisar))}>Guardar fecha</BotonAccion>
                <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="boton boton-principal" data-levantar-abrir onClick={() => setAbierto("levantar")}>✅ Levantar {v.tipo === "expulsion" ? "la expulsión" : "la suspensión"}</button>
              <button type="button" className="boton" onClick={() => setAbierto("revisar")}>📅 La revisé, sigue</button>
            </div>
          )
        ) : <p className="texto-suave text-sm">La levanta el dueño o el encargado.</p>}
      </div>
    );
  }

  if (!d.puede_suspender) return null;
  if (abierto !== "suspender") {
    return (
      <p className="mt-4">
        <button type="button" className="boton boton-chico texto-suave" data-suspender-abrir onClick={() => setAbierto("suspender")}>🚫 Suspender</button>
        {d.historial.length > 0 && <span className="texto-tenue text-sm ml-3">Tuvo {d.historial.length} {d.historial.length === 1 ? "suspensión anterior" : "suspensiones anteriores"}</span>}
      </p>
    );
  }
  return (
    <div className="tarjeta p-4 mt-4 space-y-3" data-suspender>
      <p className="font-semibold">Suspender a este socio: no entra a ningún lado hasta que se levante</p>
      {d.puede_expulsar && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo">
          <button type="button" role="radio" aria-checked={tipo === "suspension"} className={`boton ${tipo === "suspension" ? "boton-principal" : ""}`} onClick={() => setTipo("suspension")}>Suspensión</button>
          <button type="button" role="radio" aria-checked={tipo === "expulsion"} className={`boton ${tipo === "expulsion" ? "boton-principal" : ""}`} onClick={() => { setTipo("expulsion"); setHasta(""); }}>Expulsión</button>
        </div>
      )}
      <label className="block"><span className="font-semibold">Motivo (queda anotado con tu nombre)</span>
        <input className="campo mt-1" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} placeholder="Ej.: pelea en el vestuario" /></label>
      {tipo === "suspension" && (
        <label className="block"><span className="font-semibold">Hasta cuándo (si lo sabés)</span>
          <input type="date" className="campo mt-1" value={hasta} min={sumar(hoy, 1)} onChange={(e) => setHasta(e.target.value)} /></label>
      )}
      <label className="block"><span className="font-semibold">Cuándo se revisa</span>
        <input type="date" className="campo mt-1" value={revisar} min={sumar(hoy, 1)} onChange={(e) => setRevisar(e.target.value)} /></label>
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal">⚠️ {error}</p>}
      <div className="flex flex-wrap gap-2">
        <BotonAccion className="boton boton-peligro" disabled={motivo.trim().length < 3} onClick={() => correr(() => suspenderSocio(socioId, motivo, tipo, hasta, revisar))}>
          🚫 {tipo === "expulsion" ? "Expulsar" : "Suspender"}
        </BotonAccion>
        <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
      </div>
    </div>
  );
}
