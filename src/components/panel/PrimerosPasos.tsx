"use client";
// "Primeros pasos" del dueño en Inicio: el progreso lo calcula la base
// (primeros_pasos), acá solo se muestra. Cada paso lleva a la pantalla que
// lo resuelve. Se puede ocultar.
import Link from "next/link";
import { useState, useTransition } from "react";
import { ocultarPrimerosPasos } from "@/app/panel/acciones";
import { Icono } from "@/components/ui/Icono";

export type Paso = { clave: string; emoji: string; titulo: string; ayuda: string; href: string; hecho: boolean };
export type PrimerosPasosDatos = { pasos: Paso[]; hechos: number; total: number; oculto: boolean };

export function PrimerosPasos({ datos }: { datos: PrimerosPasosDatos }) {
  const [abierto, setAbierto] = useState(false);
  const [oculto, setOculto] = useState(datos.oculto);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (datos.hechos === datos.total) return null;
  if (oculto) {
    return (
      <button type="button" className="boton-texto" disabled={ocupado} data-mostrar-pasos
        onClick={() => empezar(async () => { const r = await ocultarPrimerosPasos(false); if (r.error) setError(r.error); else setOculto(false); })}>
        <Icono nombre="estrella" /> Ver los primeros pasos ({datos.hechos} de {datos.total})
      </button>
    );
  }
  const proximo = datos.pasos.find((p) => !p.hecho)!;
  const porcentaje = Math.round((datos.hechos / datos.total) * 100);
  return (
    <section aria-labelledby="primeros-pasos" className="tarjeta p-5 sm:p-6 space-y-4" data-primeros-pasos={datos.hechos}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="primeros-pasos" className="titulo text-2xl"><Icono nombre="estrella" /> Primeros pasos</h2>
        <p className="texto-suave"><span className="numero text-xl">{datos.hechos}</span> de {datos.total} listos</p>
      </div>
      <div className="h-2.5 rounded-full bg-[var(--tarjeta-alta)] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={datos.total} aria-valuenow={datos.hechos} aria-label="Progreso">
        <div className="h-full rounded-full transition-all" style={{ width: `${porcentaje}%`, background: "var(--acento)" }} />
      </div>
      <Link href="/panel/asistente" className="boton w-full sm:w-auto !justify-start" data-abrir-asistente><Icono nombre="ubicacion" /> Abrir el asistente de 9 pasos</Link>
      <Link href={`/panel${proximo.href}`} className="boton w-full sm:w-auto !justify-start text-lg !border-[var(--acento)]" data-proximo={proximo.clave}>
        <span aria-hidden><Icono nombre={proximo.emoji} sistema /></span> {proximo.titulo}
      </Link>
      <p className="texto-suave -mt-2">{proximo.ayuda}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <button type="button" className="boton-texto" aria-expanded={abierto} onClick={() => setAbierto(!abierto)}>{abierto ? "Ocultar la lista" : "Ver todos los pasos"}</button>
        <button type="button" className="boton-texto" disabled={ocupado}
          onClick={() => empezar(async () => { const r = await ocultarPrimerosPasos(true); if (r.error) setError(r.error); else { setOculto(true); setAbierto(false); } })}>
          No mostrar más
        </button>
      </div>
      {error && <p role="alert" className="mensaje mensaje-error"><Icono nombre="alerta" /> {error}</p>}
      {abierto && (
        <ul className="divide-y divide-[var(--borde)]">
          {datos.pasos.map((p) => (
            <li key={p.clave} data-paso={p.clave} data-hecho={p.hecho}>
              <Link href={`/panel${p.href}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                <span aria-hidden className="text-xl">{p.hecho ? <Icono nombre="ok" /> : <Icono nombre={p.emoji} sistema />}</span>
                <span className="min-w-0 flex-1">
                  <span className={`block font-semibold ${p.hecho ? "texto-tenue line-through" : ""}`}>{p.titulo}</span>
                  {!p.hecho && <span className="block texto-tenue text-sm">{p.ayuda}</span>}
                </span>
                {!p.hecho && <span aria-hidden className="texto-tenue">›</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
