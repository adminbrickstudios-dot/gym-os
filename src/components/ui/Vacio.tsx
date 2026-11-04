import type { ReactNode } from "react";

/** Lo vacío está vacío: un emoji, qué pasa, y qué hacer (si hay algo para hacer). */
export function Vacio({ emoji, titulo, children, acciones }: { emoji: string; titulo: string; children?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="tarjeta vacio">
      <p className="text-4xl" aria-hidden>{emoji}</p>
      <p className="titulo text-2xl">{titulo}</p>
      {children && <div className="texto-suave max-w-md">{children}</div>}
      {acciones && <div className="flex flex-wrap justify-center gap-2 mt-2">{acciones}</div>}
    </div>
  );
}
