"use client";
import { useState, useTransition } from "react";
import { cerrarAvisoClave } from "./acciones";
import { Icono } from "@/components/ui/Icono";

export type AvisoClaveDatos = { id: string; creado_en: string; por_nombre: string };

/** dd/mm/aaaa en la zona del gimnasio (formato argentino). */
export const fechaDeLaClave = (momento: string, zona: string) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(momento));

/**
 * "Te dieron una clave nueva el 11/11/2026, por Ana": para que nadie lo haga sin que el socio se entere.
 * "Entendido" lo cierra en la base: no vuelve hasta que haya una entrega más nueva. Nunca muestra la clave.
 */
export function AvisoClave({ socioId, aviso, zona }: { socioId: string; aviso: AvisoClaveDatos; zona: string }) {
  const [cerrado, setCerrado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (cerrado) return null;
  return (
    <section className="tarjeta p-5 space-y-3" aria-label="Clave nueva" data-aviso-clave={aviso.id}>
      <p className="titulo text-xl"><Icono nombre="llave" /> Te dieron una clave nueva el {fechaDeLaClave(aviso.creado_en, zona)}, por {aviso.por_nombre}.</p>
      <p className="texto-suave">Si no fuiste vos quien la pidió, avisale al gimnasio.</p>
      <button type="button" className="boton" disabled={ocupado} data-aviso-clave-entendido
        onClick={() => empezar(async () => { const r = await cerrarAvisoClave(socioId); if (r.error) setError(r.error); else { setError(null); setCerrado(true); } })}>
        <Icono nombre="ok" /> Entendido
      </button>
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
    </section>
  );
}
