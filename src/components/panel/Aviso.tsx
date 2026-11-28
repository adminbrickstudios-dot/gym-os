import type { ReactNode } from "react";
import { Icono } from "@/components/ui/Icono";

/**
 * El cartel de "no se puede" / "no hay" del panel. Vive aparte de Marco (26/11): PantallaError (la pantalla de error de TODAS las rutas) lo
 * importaba desde Marco y eso arrastraba el marco entero del panel (menú, ventana de Entrada, Cobrar) al JS de cada ruta, hasta /hacete-socio.
 * Marco lo sigue exportando: las pantallas que lo importan de ahí no cambian.
 */
export function Aviso({ icono, emoji, titulo, children }: { icono?: string; emoji?: string; titulo: string; children?: ReactNode }) {
  return (
    <div className="tarjeta p-6 sm:p-8 max-w-xl">
      <p className="text-4xl mb-4" aria-hidden><Icono nombre={icono ?? emoji ?? "alerta"} sistema /></p>
      <p className="titulo text-3xl">{titulo}</p>
      {children && <div className="texto-suave text-lg mt-2">{children}</div>}
    </div>
  );
}
