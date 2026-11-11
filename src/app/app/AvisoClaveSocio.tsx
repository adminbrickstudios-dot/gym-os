import { rpc } from "@/lib/panel/servidor";
import { AvisoClave, type AvisoClaveDatos } from "./AvisoClave";

/** Trae la última clave nueva que le dio el gimnasio y que el socio todavía no cerró. Si la base falla no se dibuja nada (no se inventa un "no hay"). */
export async function AvisoClaveSocio({ socioId, zona }: { socioId: string; zona: string }) {
  const aviso = await rpc<AvisoClaveDatos | null>("aviso_clave_socio", { p_socio_id: socioId }).catch(() => null);
  return aviso ? <AvisoClave socioId={socioId} aviso={aviso} zona={zona} /> : null;
}
