"use client";
import { useState, useTransition } from "react";
import { Mensaje } from "@/components/ui/Mensaje";
import { formatearPesos } from "@/lib/formato";
import { urlFotoProducto } from "@/lib/url-producto";
import { anotarmeEvento, bajarmeDeEvento } from "./eventos";

export type EventoApp = {
  evento_id: string; nombre: string; inicio: string; fechas: string[]; precio: number; precio_socio: number | null; mi_precio: number; descripcion: string | null;
  lugar: string | null; responsable: string | null; flyer: string | null; quedan: number; en_espera: number; lista_espera: boolean; zona: string;
  anotado: boolean; en_espera_pos: number | null; puede_cancelar: boolean; cuando_cerca: "hoy" | "manana" | null; cancelado: boolean;
};

const cuando = (iso: string, zona: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

/** VD-19: Próximos eventos con flyer, el precio que le toca, "Anotarme" y su lugar en la lista de espera. */
export function EventosApp({ socioId, eventos }: { socioId: string; eventos: EventoApp[] }) {
  return (
    <section className="space-y-2" data-eventos-app={eventos.length}>
      <p className="titulo text-2xl">🎟️ Próximos eventos</p>
      <ul className="space-y-2">{eventos.map((e) => <Tarjeta key={e.evento_id} socioId={socioId} e={e} />)}</ul>
    </section>
  );
}

function Tarjeta({ socioId, e }: { socioId: string; e: EventoApp }) {
  const [ocupado, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const flyer = urlFotoProducto(e.flyer);
  const gratis = Number(e.mi_precio) === 0;
  return (
    <li className="tarjeta p-4 space-y-2" data-evento-app={e.nombre}>
      {flyer && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flyer} alt={`Flyer de ${e.nombre}`} className="w-full max-h-72 rounded-[var(--radio)] object-cover" />
      )}
      <p className="font-semibold break-words">{e.nombre}{e.cuando_cerca && <span className="pildora pildora-amarillo ml-2" data-evento-cerca={e.cuando_cerca}>{e.cuando_cerca === "hoy" ? "Es hoy" : "Es mañana"}</span>}</p>
      <p className="texto-suave text-sm first-letter:uppercase">{cuando(e.inicio, e.zona)}{e.fechas.length > 1 ? ` · y ${e.fechas.length - 1} fecha${e.fechas.length > 2 ? "s" : ""} más` : ""}</p>
      {(e.lugar || e.responsable) && <p className="texto-suave text-sm">{[e.lugar && `📍 ${e.lugar}`, e.responsable && `👤 ${e.responsable}`].filter(Boolean).join(" · ")}</p>}
      {e.descripcion && <p className="text-sm">{e.descripcion}</p>}
      {e.cancelado ? (
        <Mensaje tipo="error">Este evento se canceló. Si pagaste, hablá con recepción.</Mensaje>
      ) : (
        <>
          <p className="text-sm" data-evento-estado={e.anotado ? "anotado" : e.en_espera_pos ? "espera" : "libre"}>
            {e.anotado ? "✅ Estás anotado"
              : e.en_espera_pos ? `⏳ Estás en la lista de espera: el lugar ${e.en_espera_pos}`
              : e.quedan === 0 ? (e.lista_espera ? "Está lleno: podés anotarte en la lista de espera" : "Sin lugares")
              : `${gratis ? "Gratis" : formatearPesos(e.mi_precio)}${e.precio_socio !== null && Number(e.precio) > Number(e.precio_socio) ? ` (precio de socio; el general es ${formatearPesos(e.precio)})` : ""} · quedan ${e.quedan}`}
          </p>
          {e.anotado && !gratis && <p className="texto-suave text-sm">Se paga en recepción ({formatearPesos(e.mi_precio)}).</p>}
          {error && <Mensaje tipo="error">{error}</Mensaje>}
          <div className="flex flex-wrap gap-2">
            {!e.anotado && !e.en_espera_pos && (e.quedan > 0 || e.lista_espera) && (
              <button type="button" className="boton" disabled={ocupado} data-anotarme
                onClick={() => empezar(async () => { const r = await anotarmeEvento(socioId, e.evento_id); setError(r.error ?? null); })}>
                {ocupado ? "Anotando…" : e.quedan > 0 ? "🎟️ Anotarme" : "⏳ Ponerme en la lista de espera"}
              </button>
            )}
            {(e.anotado || e.en_espera_pos) && e.puede_cancelar && (
              <button type="button" className="boton" disabled={ocupado} data-bajarme
                onClick={() => empezar(async () => { const r = await bajarmeDeEvento(socioId, e.evento_id); setError(r.error ?? null); })}>
                Ya no voy
              </button>
            )}
          </div>
        </>
      )}
    </li>
  );
}
