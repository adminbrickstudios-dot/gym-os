// F4/F5 · Funciones nuevas con interruptor por gimnasio (apagadas por defecto, viven en configuracion_gimnasio.funciones_nuevas).
import { rpc } from "./servidor";
export { FUNCIONES_NUEVAS, type ClaveFuncionNueva } from "./funciones-nuevas-lista";

/** Las claves prendidas de este gimnasio. Con la base caída no se inventa nada: se propaga el error. */
export async function funcionesNuevasDe(gimnasioId: string): Promise<string[]> {
  return rpc<string[]>("funciones_nuevas_gimnasio", { p_gimnasio_id: gimnasioId });
}
