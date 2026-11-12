// Funciones nuevas con interruptor por gimnasio (apagadas por defecto). Una sola fuente: la tabla funciones_nuevas_gimnasio,
// que se prende en Configuración → Funciones nuevas. Cada pantalla pregunta por su clave y, apagada, no muestra nada.
import { rpc } from "./servidor";

/** Las claves prendidas de este gimnasio. Con la base caída no se inventa nada: se propaga el error. */
export async function funcionesNuevasDe(gimnasioId: string): Promise<string[]> {
  return rpc<string[]>("funciones_nuevas_activas", { p_gimnasio_id: gimnasioId });
}
