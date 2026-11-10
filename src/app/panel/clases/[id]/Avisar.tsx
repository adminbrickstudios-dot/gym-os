"use client";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { linkWhatsappSocio } from "@/lib/whatsapp";
import { avisarClase, type MensajeClase } from "../acciones";
import { Icono } from "@/components/ui/Icono";

type Previo = { texto: string; por: string; creado_en: string; personas: number };

/**
 * COM-3: "Avisar a los anotados". Un texto con {nombre}, {clase} y {dia} y un
 * WhatsApp armado por persona; el aviso queda anotado en la clase.
 */
export function Avisar({ claseId, anotados, previos, zona }: { claseId: string; anotados: number; previos: Previo[]; zona: string }) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("Hola {nombre}! Te escribimos por {clase} del {dia}: ");
  const [mensajes, setMensajes] = useState<MensajeClase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [armando, empezar] = useTransition();
  const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  if (anotados === 0 && previos.length === 0) return null;
  return (
    <section className="tarjeta p-5 mt-8 space-y-3" data-avisar-clase>
      <p className="titulo text-xl"><Icono nombre="campana" /> Avisar a los anotados</p>
      {previos.length > 0 && (
        <ul className="space-y-1 text-sm texto-suave" data-avisos-previos={previos.length}>
          {previos.map((p) => <li key={p.creado_en}>{hora(p.creado_en)} · {p.por} ({p.personas} {p.personas === 1 ? "persona" : "personas"}): “{p.texto}”</li>)}
        </ul>
      )}
      {mensajes ? (
        <>
          <Mensaje tipo="exito">Quedó anotado en la clase. Tocá cada uno para mandarle el WhatsApp.</Mensaje>
          <ul className="flex flex-wrap gap-2" data-mensajes-clase={mensajes.length}>
            {mensajes.map((m) => {
              const wa = linkWhatsappSocio(m.telefono, m.mensaje);
              return <li key={m.socio_id}>{wa
                ? <a className="boton boton-chico" href={wa} target="_blank" rel="noopener noreferrer"><Icono nombre="mensaje" /> {m.nombre}</a>
                : <span className="pildora" title="Sin celular cargado o sin permiso para verlo">{m.nombre} · sin celular</span>}</li>;
            })}
          </ul>
          <button type="button" className="boton-texto texto-suave" onClick={() => { setMensajes(null); setAbierto(false); }}>Listo</button>
        </>
      ) : abierto ? (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); empezar(async () => { const r = await avisarClase(claseId, texto); if (r.error) setError(r.error); else { setError(null); setMensajes(r.mensajes ?? []); } }); }}>
          <textarea className="campo min-h-24" maxLength={500} value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Qué les querés avisar" />
          <p className="text-sm texto-tenue">{"{nombre}"}, {"{clase}"} y {"{dia}"} se completan solos para cada uno.</p>
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <div className="flex gap-2">
            <button type="submit" className="boton boton-principal" disabled={armando || !texto.trim()}>{armando ? "Armando…" : `Armar ${anotados} ${anotados === 1 ? "mensaje" : "mensajes"}`}</button>
            <button type="button" className="boton" onClick={() => setAbierto(false)}>Cancelar</button>
          </div>
        </form>
      ) : (
        anotados > 0 && <button type="button" className="boton" onClick={() => setAbierto(true)}><Icono nombre="campana" /> Avisar a todos ({anotados})</button>
      )}
    </section>
  );
}
