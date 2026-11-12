// F4/F5 · Funciones nuevas con interruptor por gimnasio (apagadas por defecto, viven en configuracion_gimnasio.funciones_nuevas).
// La lista de claves es la misma que acepta `guardar_funcion_nueva` en la base.
import { rpc } from "./servidor";

export const FUNCIONES_NUEVAS = [
  { clave: "borrador_alta", titulo: "Borrador del alta de socio", ayuda: "Si se corta el alta a la mitad, al volver pregunta “¿Seguimos donde dejaste?”. Se guarda solo en esa computadora, por 7 días." },
  { clave: "panel_pago", titulo: "Más datos en el panel del socio", ayuda: "En la ficha rápida que abre la Entrada: cuándo le toca pagar y cuánto, desde cuándo debe, qué plan pagaría, y sus notas y etiquetas." },
  { clave: "horarios_pico", titulo: "Horarios pico por día de la semana", ayuda: "En Resultado: un cuadro con las entradas de las últimas 8 semanas por día y hora." },
] as const;

export type ClaveFuncionNueva = (typeof FUNCIONES_NUEVAS)[number]["clave"];

/** Las claves prendidas de este gimnasio. Con la base caída no se inventa nada: se propaga el error. */
export async function funcionesNuevasDe(gimnasioId: string): Promise<string[]> {
  return rpc<string[]>("funciones_nuevas_gimnasio", { p_gimnasio_id: gimnasioId });
}
