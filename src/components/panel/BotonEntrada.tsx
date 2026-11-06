"use client";
import Link from "next/link";
import { EVENTO_ABRIR_ENTRADA } from "./VentanaEntrada";

/**
 * El botón grande de Inicio: abre la ventana de Entrada sin salir de Inicio (VD-1).
 * Si por algo la ventana no está (sin sede activa), lleva a la pantalla de Entrada de siempre.
 */
export function BotonEntrada({ className }: { className: string }) {
  return (
    <Link href="/panel/entrada" data-boton-entrada className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || document.documentElement.dataset.entradaLista !== "si") return;   // abrir en pestaña nueva sigue andando
        e.preventDefault();
        window.dispatchEvent(new Event(EVENTO_ABRIR_ENTRADA));
      }}>
      <span aria-hidden>🚪</span> Entrada
      <span className="text-lg font-normal opacity-90 hidden sm:inline">o tipeá un DNI</span>
    </Link>
  );
}
