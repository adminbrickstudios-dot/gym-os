"use client";
import { useEffect, useRef, type ReactNode } from "react";

const ENFOCABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * La hoja flotante de todo el sistema (Ctrl+K, menús, Cobrar): fondo atenuado, panel de vidrio
 * con `.hoja` (escala al entrar; en el celular sube desde abajo). Esc la cierra, tocar afuera
 * también, el foco queda atrapado adentro y vuelve a donde estaba al cerrar.
 */
export function Hoja({ abierta, alCerrar, etiqueta, children, className = "", alineacion = "centro" }: {
  abierta: boolean; alCerrar: () => void; etiqueta: string; children: ReactNode; className?: string;
  /** `arriba` para un buscador (queda cerca del borde de arriba); `centro` para el resto. */
  alineacion?: "arriba" | "centro";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const cerrar = useRef(alCerrar);
  useEffect(() => { cerrar.current = alCerrar; });

  useEffect(() => {
    if (!abierta) return;
    const antes = document.activeElement as HTMLElement | null;
    const p = panel.current;
    if (p && !p.contains(document.activeElement)) (p.querySelector<HTMLElement>(ENFOCABLES) ?? p).focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") { cerrar.current(); return; }
      if (e.key !== "Tab" || !p) return;
      const todos = [...p.querySelectorAll<HTMLElement>(ENFOCABLES)].filter((x) => x.offsetParent !== null);
      if (todos.length === 0) { e.preventDefault(); p.focus(); return; }
      const primero = todos[0], ultimo = todos[todos.length - 1];
      if (e.shiftKey && (document.activeElement === primero || !p.contains(document.activeElement))) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && (document.activeElement === ultimo || !p.contains(document.activeElement))) { e.preventDefault(); primero.focus(); }
    };
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("keydown", tecla); if (antes?.isConnected) antes.focus(); };
  }, [abierta]);

  if (!abierta) return null;
  return (
    <div className={`aparecer fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-center px-3 ${alineacion === "arriba" ? "items-start pt-[10vh]" : "items-end sm:items-center pb-3 sm:pb-0"}`} onClick={alCerrar}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={etiqueta} tabIndex={-1} onClick={(e) => e.stopPropagation()}
        className={`hoja vidrio w-full max-w-xl overflow-hidden rounded-[var(--radio-grande)] outline-none ${className}`}>
        {children}
      </div>
    </div>
  );
}
