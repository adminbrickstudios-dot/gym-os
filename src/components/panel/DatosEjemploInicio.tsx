import { Mensaje } from "@/components/ui/Mensaje";
import { DatosEjemplo } from "./DatosEjemplo";

/** VD-43, en Inicio del dueño: cuántos socios de ejemplo hay y si corresponde ofrecerlos. Los datos vienen en el lote de la página (Cacería 18/11); null = la lectura falló. */
export function DatosEjemploInicio({ datos, sinSociosReales }: { datos: { cargados: number } | null; sinSociosReales: boolean }) {
  if (!datos) return <Mensaje tipo="error">No pudimos revisar los datos de ejemplo. Probá de nuevo.</Mensaje>;
  return <DatosEjemplo cargados={datos.cargados} ofrecer={sinSociosReales} />;
}
