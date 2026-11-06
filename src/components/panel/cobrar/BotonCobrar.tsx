"use client";
// VD-5 · El "💵 Cobrar" de la ficha, Vencen hoy y Retención: abre la hoja Cobrar en el lugar.
// Sigue siendo un link a Vender con el socio (se puede abrir en otra pestaña, y si la hoja no
// está montada, navega como siempre).
import Link from "next/link";
import type { ReactNode } from "react";
import { useRutaDisponible } from "@/components/panel/LinkPanel";
import { abrirCobrar, hayHojaCobrar, type OrigenCobro } from "./evento";

export function BotonCobrar({ socioId, origen, cuota = false, className = "boton", children }: {
  socioId: string; origen: OrigenCobro;
  /** Para armar el link de respaldo con la cuota cargada. */
  cuota?: boolean; className?: string; children: ReactNode;
}) {
  const disponible = useRutaDisponible("/panel/vender");
  if (!disponible) return null;
  return (
    <Link href={`/panel/vender?socio=${socioId}${cuota ? "&cuota=1" : ""}`} className={className} data-cobrar-abrir
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !hayHojaCobrar()) return;
        e.preventDefault();
        abrirCobrar({ socioId, origen });
      }}>
      {children}
    </Link>
  );
}
