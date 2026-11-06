import { rpc } from "@/lib/panel/servidor";
import type { CalculoDevolucion } from "../moderacion-acciones";
import { NoEscribirle, type DatosNoEscribirle } from "./NoEscribirle";
import { Cortesias, DevolucionBaja, Suspension, type DatosCortesias, type DatosSuspension } from "./Moderacion";

type Constancia = { codigo: string; estado: string; motivo: string; pedido_en: string; resuelto_en: string | null; resuelto_por: string | null } | null;

/** VD-46E: la constancia de la baja (código, cuándo y quién la dio), debajo de “Dado de baja el …”. */
export async function ConstanciaBaja({ socioId, zona }: { socioId: string; zona: string }) {
  const [c, devolucion] = await Promise.all([
    rpc<Constancia>("constancia_baja", { p_socio_id: socioId }),
    rpc<CalculoDevolucion>("calcular_devolucion_baja", { p_socio_id: socioId }),
  ]);
  const f = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  return (
    <>
      {c && c.estado === "dado_de_baja" && (
        <p className="mensaje mensaje-info" data-constancia-baja>
          🧾 <span>Constancia <strong>{c.codigo}</strong> · pedida el {f(c.pedido_en)}{c.resuelto_en ? ` · dada el ${f(c.resuelto_en)}` : ""}{c.resuelto_por ? ` por ${c.resuelto_por}` : ""}</span>
        </p>
      )}
      <DevolucionBaja socioId={socioId} calculo={devolucion} zona={zona} />
    </>
  );
}

/** VD-46: lo que la ficha muestra de moderación (suspensión y cortesías). Si la base lo niega, es un error, no un bloque vacío. */
export async function ModeracionFicha({ socioId, zona }: { socioId: string; zona: string }) {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date());
  const [suspension, cortesias, noEscribirle] = await Promise.all([
    rpc<DatosSuspension>("suspension_socio", { p_socio_id: socioId }),
    rpc<DatosCortesias>("cortesias_socio", { p_socio_id: socioId }),
    rpc<DatosNoEscribirle>("no_escribirle_socio", { p_socio_id: socioId }),   // VD-46N
  ]);
  return (
    <>
      <NoEscribirle socioId={socioId} datos={noEscribirle} zona={zona} />
      <Suspension socioId={socioId} datos={suspension} zona={zona} hoy={hoy} />
      {!suspension.vigente && <Cortesias socioId={socioId} datos={cortesias} zona={zona} />}
    </>
  );
}
