"use client";
import Link from "next/link";
import { EVENTO_ABRIR_ENTRADA } from "./entrada/comun";
import { Icono } from "@/components/ui/Icono";

/**
 * El botón grande de Inicio: abre la ventana de Entrada sin salir de Inicio (VD-1).
 * Si por algo la ventana no está (sin sede activa), lleva a la pantalla de Entrada de siempre.
 */
export function BotonEntrada({ className, barra = false }: { className: string; /** Recepción (el mostrador): una barra de búsqueda gigante siempre arriba, no un botón verde. */ barra?: boolean }) {
  return (
    <Link href="/panel/entrada" data-boton-entrada data-barra-mostrador={barra ? "si" : undefined}
      className={barra ? "flex items-center gap-4 w-full min-h-20 px-6 rounded-[var(--radio)] border border-[var(--borde)] bg-[var(--tarjeta)] text-2xl sm:text-3xl texto-suave active:scale-[0.99] transition" : className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || document.documentElement.dataset.entradaLista !== "si") return;   // abrir en pestaña nueva sigue andando
        e.preventDefault();
        window.dispatchEvent(new Event(EVENTO_ABRIR_ENTRADA));
      }}>
      {barra ? (
        <>
          <span aria-hidden className="text-[var(--texto)]"><Icono nombre="buscar" /></span>
          <span className="flex-1 min-w-0 truncate">DNI, nombre, teléfono o pasá el QR…</span>
          <kbd className="pildora !text-base flex-none">F2</kbd>
        </>
      ) : (
        <>
          <span aria-hidden><Icono nombre="puerta" /></span> Entrada
          <span className="text-lg font-normal opacity-90 hidden sm:inline">o tipeá un DNI</span>
        </>
      )}
    </Link>
  );
}
