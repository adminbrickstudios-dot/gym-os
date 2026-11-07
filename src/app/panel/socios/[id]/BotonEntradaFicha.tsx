"use client";
// VD-15 · "🚪 Entrada" en el encabezado de la ficha: abre la ventana de Entrada (VD-1) ya con este socio
// elegido, sin salir de la ficha. Si la ventana no está montada (sin sede activa) lleva a la pantalla de Entrada.
import Link from "next/link";
import { EVENTO_ABRIR_SOCIO } from "@/components/panel/AvisosEntrada";
import { useRutaDisponible } from "@/components/panel/LinkPanel";
import type { ResultadoSocio } from "@/app/panel/acciones";

export function BotonEntradaFicha({ socio, className = "boton" }: { socio: ResultadoSocio; className?: string }) {
  // Con la sección Entrada apagada no hay a dónde ir: el botón no se muestra.
  if (!useRutaDisponible("/panel/entrada")) return null;
  return (
    <Link href={`/panel/entrada?socio=${socio.socio_id}`} className={className} data-ficha-entrada
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || document.documentElement.dataset.ventanaEntrada !== "si") return;
        e.preventDefault();
        window.dispatchEvent(new CustomEvent<ResultadoSocio>(EVENTO_ABRIR_SOCIO, { detail: socio }));
      }}>
      🚪 Entrada
    </Link>
  );
}
