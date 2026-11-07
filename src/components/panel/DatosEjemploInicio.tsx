import { Mensaje } from "@/components/ui/Mensaje";
import { rpcLectura } from "@/lib/panel/servidor";
import { DatosEjemplo } from "./DatosEjemplo";

/** VD-43, en Inicio del dueño: cuántos socios de ejemplo hay y si corresponde ofrecerlos. */
export async function DatosEjemploInicio({ gimnasioId, sinSociosReales }: { gimnasioId: string; sinSociosReales: boolean }) {
  try {
    const { cargados } = await rpcLectura<{ cargados: number }>("datos_ejemplo", { p_gimnasio_id: gimnasioId });
    return <DatosEjemplo cargados={cargados} ofrecer={sinSociosReales} />;
  } catch (e) {
    return <Mensaje tipo="error">No pudimos revisar los datos de ejemplo: {(e as Error).message}</Mensaje>;
  }
}
