"use client";
// E4 · La barra fija de la derecha (compu ≥ 1280 px, opcional por gimnasio): el DNI siempre a mano y las últimas 5 entradas.
import type { MutableRefObject, RefObject } from "react";
import type { DetectorLector } from "@/app/panel/entrada/lector";
import type { UltimaEntrada } from "@/app/panel/entrada/ventana-acciones";
import { Icono } from "@/components/ui/Icono";
import { PuntoEstado } from "../Estado";
import { conPuntos, sinPuntos } from "./comun";

export default function BarraFija({ barra, detector, textoBarra, setTextoBarra, enviar, ultimas, hora }: {
  barra: RefObject<HTMLInputElement | null>; detector: MutableRefObject<DetectorLector>;
  textoBarra: string; setTextoBarra: (t: string) => void; enviar: (crudo: string, lector?: boolean) => void;
  ultimas: UltimaEntrada[]; hora: (d: Date) => string;
}) {
  return (
    <aside data-barra-entrada aria-label="Entrada" className="hidden xl:flex fixed right-0 top-0 bottom-0 w-72 z-20 flex-col gap-4 border-l border-[var(--borde)] bg-[var(--fondo)] p-4 pt-20">
      <p className="titulo text-xl"><Icono nombre="puerta" /> Entrada</p>
      <input ref={barra} data-barra-dni value={conPuntos(textoBarra)} inputMode="numeric" autoComplete="off" aria-label="DNI, número de socio o nombre"
        onChange={(e) => setTextoBarra(sinPuntos(e.target.value))}
        onKeyDown={(e) => {
          detector.current.tecla(e.key, e.timeStamp);
          // C5: lectura del lector USB en la barra fija: se toma del campo, se vacía y el foco se queda para la próxima.
          if (e.key === "Enter" && detector.current.enter(e.timeStamp) && e.currentTarget.value.trim()) {
            e.preventDefault(); const t = sinPuntos(e.currentTarget.value); setTextoBarra(""); enviar(t, true); return;
          }
          if (e.key === "Enter" && textoBarra.trim()) { e.preventDefault(); const t = textoBarra; setTextoBarra(""); enviar(t); }
          if (e.key === "Escape") { setTextoBarra(""); barra.current?.blur(); }
        }}
        placeholder="DNI o nombre" className="campo !min-h-14 !text-2xl text-center" />
      <p className="texto-tenue text-sm -mt-2">Enter para buscar · F2 enfoca acá</p>
      <p className="titulo-grupo mt-2">Últimas entradas</p>
      {ultimas.length === 0 ? <p className="texto-tenue text-sm">Todavía no entró nadie hoy.</p> : (
        <ul className="space-y-2 min-w-0" data-barra-ultimas={ultimas.length}>
          {ultimas.map((u) => (
            <li key={u.ingreso_id} className="flex items-center gap-2 min-w-0 text-sm">
              <PuntoEstado color={u.color} />
              <span className="truncate flex-1">{u.socio}</span>
              <span className="texto-tenue tabular-nums">{hora(new Date(u.momento))}</span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
