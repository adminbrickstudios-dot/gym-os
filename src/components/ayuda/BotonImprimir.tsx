"use client";
// C3/C4 · "Imprimir / guardar PDF": abre la impresión del navegador (ahí se elige "Guardar como PDF"). Solo se ve en pantalla.
import { Icono } from "@/components/ui/Icono";

export function BotonImprimir({ texto = "Imprimir / guardar PDF", principal = true }: { texto?: string; principal?: boolean }) {
  return (
    <button type="button" className={`boton ${principal ? "boton-principal" : ""}`} data-imprimir onClick={() => window.print()}>
      <Icono nombre="recibo" /> {texto}
    </button>
  );
}
