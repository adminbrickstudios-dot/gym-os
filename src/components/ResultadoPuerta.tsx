// Pista Semáforo (24/11) · EL resultado de la puerta: el mismo en el Inicio, la Entrada, el kiosco y la ficha (componentes.png).
// No calcula nada: el color, si puede pasar y el texto salen de calcular_acceso (estado_acceso / entrar), como siempre.
// "PASA" o "NO PASA" es solo la palabra del semáforo para `puede`. Sin la llave pista_semaforo se ve igual que la tarjeta de siempre
// (las clases .puerta* solo tienen forma con data-semaforo; sin ella son una tarjeta del color del resultado).
import type { ReactNode } from "react";
import { Icono } from "@/components/ui/Icono";
import { palabraPuerta } from "@/lib/puerta";

export type ColorPuerta = "verde" | "amarillo" | "rojo" | "gris";

const EMOJI: Record<ColorPuerta, string> = { verde: "ok", amarillo: "reloj", rojo: "prohibido", gris: "ayuda" };

export function ResultadoPuerta({ color, puede, nombre, detalle, texto, arriba, titulo, tamano = "normal", children, ...datos }: {
  color: ColorPuerta; puede: boolean; nombre?: ReactNode; detalle?: ReactNode;
  /** El texto de la base (calcular_acceso): de ahí sale "VENCE MAÑANA". Si no se pasa y el detalle es texto, se usa el detalle. */
  texto?: string | null;
  arriba?: ReactNode;
  /** Solo para el kiosco y la app ("PASÁ", "PROBÁ DE NUEVO"): por defecto, PASA / NO PASA según `puede`. */
  titulo?: string; tamano?: "normal" | "kiosco"; children?: ReactNode;
} & Record<`data-${string}`, string | number | boolean | undefined>) {
  const base = texto ?? (typeof detalle === "string" ? detalle : null);
  return (
    <section className={`puerta puerta-${color} ${tamano === "kiosco" ? "puerta-kiosco" : ""}`} data-puerta={color} aria-live="polite" {...datos}>
      {arriba && <div className="puerta-arriba">{arriba}</div>}
      <div className="puerta-titulo">
        <span className="puerta-emoji" aria-hidden><Icono nombre={EMOJI[color]} /></span>
        <span className="puerta-palabra" data-puerta-palabra>{titulo ?? palabraPuerta(puede, color, base)}</span>
      </div>
      {nombre && <div className="puerta-nombre">{nombre}</div>}
      {detalle && <div className="puerta-detalle">{detalle}</div>}
      {children && <div className="puerta-acciones">{children}</div>}
    </section>
  );
}
