"use client";
import { useState, useTransition } from "react";
import type { MapaLugares } from "@/lib/clases/lugares";
import { elegirLugar } from "../acciones";
import { Icono } from "@/components/ui/Icono";

/** COM-12: con la reserva confirmada, el socio elige su lugar en la sala (la bici, el reformer). */
export function ElegirLugar({ mapa }: { mapa: MapaLugares }) {
  const [mio, setMio] = useState(mapa.mio);
  const [abierto, setAbierto] = useState(mapa.mio == null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (!mapa.reserva_id) return null;
  const fuera = new Set(mapa.fuera_servicio);
  const tomados = new Set(mapa.ocupados.filter((n) => n !== mio));
  return (
    <div className="basis-full" data-elegir-lugar data-mio={mio ?? ""}>
      {!abierto && mio != null ? (
        <p className="flex items-center gap-2">
          <span className="pildora"><Icono nombre="ubicacion" /> {mapa.etiqueta} {mio}</span>
          <button type="button" className="underline text-sm" onClick={() => setAbierto(true)}>Cambiar</button>
        </p>
      ) : (
        <>
          <p className="text-sm font-semibold mb-2"><Icono nombre="ubicacion" /> Elegí tu lugar ({mapa.etiqueta.toLowerCase()})</p>
          <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
            {Array.from({ length: mapa.cantidad }, (_, i) => i + 1).map((n) => {
              const roto = fuera.has(n), tomado = tomados.has(n), esMio = n === mio;
              return (
                <button key={n} type="button" data-lugar={n} disabled={ocupado || roto || tomado}
                  aria-label={`${mapa.etiqueta} ${n}${roto ? ", fuera de servicio" : tomado ? ", ocupado" : esMio ? ", el tuyo" : ""}`}
                  className={`boton !min-h-11 !px-0 numero ${esMio ? "boton-principal" : ""} ${roto ? "line-through opacity-40" : tomado ? "opacity-40" : ""}`}
                  onClick={() => empezar(async () => {
                    setError(null);
                    const r = await elegirLugar(mapa.reserva_id!, n);
                    if (r.error) setError(r.error); else { setMio(n); setAbierto(false); }
                  })}>{roto ? "✕" : n}</button>
              );
            })}
          </div>
          {error && <p role="alert" className="pildora pildora-rojo w-full mt-2"><Icono nombre="alerta" /> {error}</p>}
        </>
      )}
    </div>
  );
}
