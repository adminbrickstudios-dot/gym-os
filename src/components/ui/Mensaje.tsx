import type { ReactNode } from "react";
import { Icono } from "@/components/ui/Icono";

const EMOJI = { error: "!", exito: "✓", aviso: "", info: "" } as const;
export type TipoMensaje = keyof typeof EMOJI;

/**
 * Resultado de una acción o un error. Los errores se anuncian (role=alert);
 * el resto, sin interrumpir (role=status). Siempre con emoji y texto: nunca solo color.
 */
export function Mensaje({ tipo = "info", children, accion, className = "" }: {
  tipo?: TipoMensaje; children: ReactNode; accion?: ReactNode; className?: string;
}) {
  return (
    <div role={tipo === "error" ? "alert" : "status"} className={`aparecer mensaje mensaje-${tipo} ${className}`}>
      <span aria-hidden><Icono nombre={EMOJI[tipo]} /></span>
      <div className="min-w-0 flex-1">{children}</div>
      {accion && <div className="flex-none">{accion}</div>}
    </div>
  );
}
