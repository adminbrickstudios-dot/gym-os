"use client";
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { useFormStatus } from "react-dom";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  /** Texto mientras trabaja. */
  ocupadoTexto?: string;
  /** Acción asíncrona: mientras corre, el botón queda deshabilitado e ignora un segundo toque. Sin esto, es el botón de un `<form action>`. */
  onClick?: (e: MouseEvent<HTMLButtonElement>) => unknown | Promise<unknown>;
};

/**
 * El botón de todo lo que escribe (VD-34): se deshabilita y dice "Guardando…" hasta que
 * responde, y un segundo toque (doble clic, Enter repetido) se ignora. En un `<form action>`
 * se entera solo (useFormStatus); con `onClick` asíncrono lleva su propia traba.
 */
export function BotonAccion({ ocupadoTexto = "Guardando…", onClick, children, disabled, className = "boton", type, ...resto }: Props) {
  const { pending } = useFormStatus();
  const [propio, setPropio] = useState(false);
  const traba = useRef(false);
  const ocupado = pending || propio;
  // FLUIDEZ regla 2: a los 10 s sin respuesta lo dice, en vez de quedar mudo. No reintenta solo: un segundo cobro lo decide quien tiene la clave de la operación.
  const [lento, setLento] = useState(false);
  useEffect(() => {
    if (!ocupado) { setLento(false); return; }
    const t = setTimeout(() => setLento(true), 10_000);
    return () => clearTimeout(t);
  }, [ocupado]);
  const tocar = async (e: MouseEvent<HTMLButtonElement>) => {
    if (!onClick) return;
    if (traba.current) { e.preventDefault(); return; }
    traba.current = true; setPropio(true);
    try { await onClick(e); } finally { traba.current = false; setPropio(false); }
  };
  return (
    <button {...resto} type={onClick ? "button" : (type ?? "submit")} className={className} disabled={disabled || ocupado} aria-busy={ocupado || undefined} data-lento={lento || undefined} onClick={onClick ? tocar : undefined}>
      {ocupado ? (lento ? "Está tardando más de lo normal…" : ocupadoTexto) : children}
    </button>
  );
}
