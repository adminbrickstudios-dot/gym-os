"use client";
import { useState, useTransition } from "react";
import { aceptarOferta, rechazarOferta } from "./ofertas-acciones";
import { Icono } from "@/components/ui/Icono";

export type OfertaLugarDatos = { reserva_id: string; clase_id: string; actividad: string; inicio: string; hasta: string };

const hora = (m: string, zona: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
const dia = (m: string, zona: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "long", day: "numeric", month: "numeric" }).format(new Date(m));

/** FA-23: "Se liberó un lugar": aceptar o dejar pasar, con el plazo a la vista. Lo decide la base (plazo y habilitación). */
export function OfertasLugar({ ofertas, zona }: { ofertas: OfertaLugarDatos[]; zona: string }) {
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (!ofertas.length) return null;
  return (
    <section className="space-y-3" aria-label="Lugares ofrecidos" data-ofertas-lugar>
      {ofertas.map((o) => (
        <div key={o.reserva_id} className="tarjeta p-4 space-y-3 border-2 border-[var(--acento)]">
          <p className="titulo text-2xl">Se liberó un lugar en {o.actividad}</p>
          <p className="texto-suave">{dia(o.inicio, zona)} a las {hora(o.inicio, zona)}. Tenés hasta las <strong className="text-[var(--texto)]">{hora(o.hasta, zona)}</strong> para aceptarlo.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="boton boton-principal !min-h-12" disabled={ocupado} data-aceptar-oferta
              onClick={() => empezar(async () => { const r = await aceptarOferta(o.reserva_id); setError(r.error ?? null); })}>Aceptar el lugar</button>
            <button type="button" className="boton !min-h-12" disabled={ocupado}
              onClick={() => empezar(async () => { const r = await rechazarOferta(o.reserva_id); setError(r.error ?? null); })}>No lo quiero</button>
          </div>
        </div>
      ))}
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal"><Icono nombre="alerta" /> {error}</p>}
    </section>
  );
}
