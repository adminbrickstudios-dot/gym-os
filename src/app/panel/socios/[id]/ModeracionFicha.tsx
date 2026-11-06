import { rpc } from "@/lib/panel/servidor";
import { Cortesias, Suspension, type DatosCortesias, type DatosSuspension } from "./Moderacion";

/** VD-46: lo que la ficha muestra de moderación (suspensión y cortesías). Si la base lo niega, es un error, no un bloque vacío. */
export async function ModeracionFicha({ socioId, zona }: { socioId: string; zona: string }) {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date());
  const [suspension, cortesias] = await Promise.all([
    rpc<DatosSuspension>("suspension_socio", { p_socio_id: socioId }),
    rpc<DatosCortesias>("cortesias_socio", { p_socio_id: socioId }),
  ]);
  return (
    <>
      <Suspension socioId={socioId} datos={suspension} zona={zona} hoy={hoy} />
      {!suspension.vigente && <Cortesias socioId={socioId} datos={cortesias} zona={zona} />}
    </>
  );
}
