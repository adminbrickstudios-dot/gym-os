"use client";
// Auditoría 18/11 · "Con sonido" no se entendía como botón: ahora es un interruptor que dice qué hace ("Sonido al anotar") y cómo está (Sí / No).
// Los atributos data-* de cada pantalla (data-sonido, data-sonido-ventana) los pasa quien lo usa, para no romper las pruebas.
import type { ReactNode } from "react";

export function InterruptorSonido({ sonido, onClick, datos, icono }: { sonido: boolean; onClick: () => void; datos: Record<string, string>; icono?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={sonido} onClick={onClick} {...datos}
      className="min-h-11 px-3 inline-flex items-center gap-2 rounded-[var(--radio)] border border-[var(--borde)] text-sm texto-suave active:opacity-60">
      {icono}
      <span>Sonido al anotar</span>
      <span aria-hidden data-interruptor-pista className="relative inline-block h-6 w-11 flex-none rounded-full border border-[var(--borde)] transition-colors"
        style={{ background: sonido ? "var(--ok, #2f9e5b)" : "var(--tarjeta-alta, var(--tarjeta))" }}>
        <span className="absolute top-0.5 size-4 rounded-full bg-[var(--texto)] transition-all" style={{ left: sonido ? "1.375rem" : "0.125rem" }} />
      </span>
      <span className="font-semibold min-w-6 text-[var(--texto)]">{sonido ? "Sí" : "No"}</span>
    </button>
  );
}
