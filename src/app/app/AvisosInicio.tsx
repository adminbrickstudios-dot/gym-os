import { rpc } from "@/lib/panel/servidor";
import { AvisosSocio, type AvisoApp } from "./AvisosSocio";

/** VD-46D: trae los avisos sin leer del socio; si la base falla se oculta la tarjeta (no se inventa un "no hay" en pantalla). */
export async function AvisosInicio({ socioId }: { socioId: string }) {
  const avisos = await rpc<AvisoApp[]>("mis_avisos", { p_socio_id: socioId }).catch(() => null);
  return avisos?.length ? <AvisosSocio avisos={avisos} /> : null;
}
