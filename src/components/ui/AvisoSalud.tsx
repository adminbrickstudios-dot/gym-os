import { AVISO_REESCRIBIR, detectarSalud } from "@/lib/salud";

/** VD-46H: aviso en vivo debajo de un campo libre cuando el texto parece un dato de salud. */
export function AvisoSalud({ texto }: { texto: string }) {
  if (!detectarSalud(texto)) return null;
  return <p role="alert" className="text-sm font-semibold text-[var(--rojo)]" data-aviso-salud-detectado>🩺 {AVISO_REESCRIBIR}</p>;
}
