"use client";
// VD-53 · El botón de Inicio para la recepción y los profes: "Fichar entrada" / "Fichar salida".
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ficharAhora, type ResFichaje } from "@/app/panel/fichar/acciones";
import { Mensaje } from "@/components/ui/Mensaje";
import { horaLocal, textoMinutos } from "@/lib/fichaje";

export function textoResultado(r: ResFichaje, zona: string): string {
  if (r.accion === "entrada") return `Entrada fichada a las ${horaLocal(r.momento!, zona)}${r.nombre ? `, ${r.nombre}` : ""}.`;
  if (r.accion === "salida") return `Salida fichada a las ${horaLocal(r.momento!, zona)}${r.nombre ? `, ${r.nombre}` : ""}: ${textoMinutos(r.minutos ?? 0)} de turno.`;
  return r.aviso ?? "Listo.";
}

export function BotonFichar({ nombre, enTurno, entradaEn, sinSalidaDesde, zona }: {
  nombre: string; enTurno: boolean; entradaEn: string | null; sinSalidaDesde: string | null; zona: string;
}) {
  const router = useRouter();
  const [ocupado, empezar] = useTransition();
  const [res, setRes] = useState<ResFichaje | null>(null);
  const accion = enTurno ? "salida" : "entrada";
  return (
    <section className="tarjeta p-4 space-y-3" aria-label="Fichaje" data-fichaje>
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1">
          <span aria-hidden>⏱️</span> {enTurno ? <>En turno desde las <strong>{horaLocal(entradaEn!, zona)}</strong></> : <>Fichás como <strong data-fichaje-nombre>{nombre}</strong></>}
          {sinSalidaDesde && <span className="texto-suave text-sm block">Tu entrada de las {horaLocal(sinSalidaDesde, zona)} quedó sin salida: no suma horas hasta que el dueño la corrija.</span>}
        </p>
        <button type="button" className="boton boton-principal" disabled={ocupado} data-fichar={accion}
          onClick={() => empezar(async () => { setRes(await ficharAhora(accion)); router.refresh(); })}>
          {ocupado ? "Fichando…" : enTurno ? "Fichar salida" : "Fichar entrada"}
        </button>
        <Link href="/panel/fichar" className="texto-suave text-sm underline">Con mi PIN · mis horas</Link>
      </div>
      {res && (res.error
        ? <Mensaje tipo="error">{res.error}</Mensaje>
        : <Mensaje tipo={res.accion === "entrada" || res.accion === "salida" ? "exito" : "aviso"}>{textoResultado(res, zona)}</Mensaje>)}
    </section>
  );
}
