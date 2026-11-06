import { rpc } from "@/lib/panel/servidor";
import { Suspension, type DatosSuspension } from "./Moderacion";

/** VD-46: lo que la ficha muestra de moderación (suspensión; después cortesías). Busca lo suyo (si la base lo niega, es un error, no un bloque vacío). */
export async function ModeracionFicha({ socioId, zona }: { socioId: string; zona: string }) {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date());
  const suspension = await rpc<DatosSuspension>("suspension_socio", { p_socio_id: socioId });
  return <Suspension socioId={socioId} datos={suspension} zona={zona} hoy={hoy} />;
}
