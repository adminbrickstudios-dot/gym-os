import { AvisosSocio, type AvisoApp } from "./AvisosSocio";

/** VD-46D: los avisos sin leer del socio (vienen en el lote del Inicio); si la base falló llega null y se oculta la tarjeta (no se inventa un "no hay"). */
export function AvisosInicio({ avisos }: { avisos: AvisoApp[] | null }) {
  return avisos?.length ? <AvisosSocio avisos={avisos} /> : null;
}
