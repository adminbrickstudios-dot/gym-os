import type { ReactNode } from "react";
import { Icono } from "@/components/ui/Icono";

/** Lo vacío está vacío: un ícono, qué pasa, y qué hacer (si hay algo para hacer). */
export function Vacio({ icono, emoji, titulo, children, acciones }: { icono?: string; emoji?: string; titulo: string; children?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="tarjeta vacio">
      {(icono ?? emoji) && <p className="text-4xl" aria-hidden><Icono nombre={icono ?? emoji} sistema /></p>}
      <p className="titulo text-2xl">{titulo}</p>
      {children && <div className="texto-suave max-w-md">{children}</div>}
      {acciones && <div className="flex flex-wrap justify-center gap-2 mt-2">{acciones}</div>}
    </div>
  );
}
