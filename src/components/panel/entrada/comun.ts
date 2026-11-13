// E4 · Lo que comparten las piezas de la Entrada (ventana grande, barrita, alta rápida, prueba gratis).
// Sin React ni acciones de servidor: se puede importar desde cualquier lado sin arrastrar la ventana.
import type { ResultadoSocio } from "@/app/panel/acciones";
import type { PruebaDni, ResultadoIngreso } from "@/app/panel/entrada/acciones";
import type { PlanParaAlta, ProspectoOfrecido } from "@/app/panel/socios/acciones";

export const EVENTO_ABRIR_ENTRADA = "gymos:abrir-entrada";
/** VD-29: abrir la ventana con un DNI, número o nombre ya escrito (detail = el texto). */
export const EVENTO_ABRIR_ENTRADA_CON = "gymos:abrir-entrada-con";

export const ES_QR = /^GYMOS1\./;
export const EMOJI: Record<string, string> = { verde: "ok", amarillo: "alerta", naranja: "alerta", rojo: "prohibido", gris: "ayuda" };

export type Paso = "escribir" | "veredicto" | "anotado" | "alta" | "salio" | "prueba";
/** VD-51: lo que se escribe para darle la prueba gratis a un DNI nuevo (o a quien reservó desde la página). */
export type FormPrueba = { dni: string; nombre: string; apellido: string; telefono: string; info: PruebaDni | null; error: string | null };
/** VD-6 · El alta rápida dentro de la ventana: datos → plan → (cobro en la hoja) → entra. */
export type Alta = {
  dni: string; nombre: string; apellido: string; telefono: string; plan: string;
  paso: "datos" | "plan"; planes: PlanParaAlta[] | null; ofrecido: ProspectoOfrecido | null; vinculado: string | null; error: string | null;
};
export type Hecho = ResultadoIngreso & { nombre: string; hora: string; socioId: string };

export const CLAVE_SEDE = "gymos.entrada.sede";
/** VD-1b: la ficha abierta desde la ventana deja acá el socio (CLAVE_FICHA); su "Volver" lo pide de vuelta (CLAVE_VOLVER). */
export const CLAVE_FICHA = "gymos.entrada.ficha";
export const CLAVE_VOLVER = "gymos.entrada.volver";

/** E1: abrir la ventana grande con un socio (lo escucha la ventana). `dejar`: además, ir directo a "Dejar pasar". */
export type PedidoAbrirSocio = ResultadoSocio & { dejar?: boolean };

/** Un campo donde se escribe (la ventana y la barrita nunca le roban el foco). */
export const esEditable = (t: EventTarget | null) => {
  const e = t as HTMLElement | null;
  if (!e || !e.tagName) return false;
  return e.tagName === "INPUT" || e.tagName === "TEXTAREA" || e.tagName === "SELECT" || e.isContentEditable;
};

/** El DNI con puntos a medida que se tipea (30.123.456); si no son solo números, tal cual. */
export function conPuntos(t: string): string {
  if (!/^[\d.]*$/.test(t)) return t;
  const d = t.replace(/\./g, "");
  return d.length >= 7 && d.length <= 8 ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : d;
}
export const sinPuntos = (t: string) => (/^[\d.]*$/.test(t) ? t.replace(/\./g, "") : t);

/** Hay algo encima que tiene el teclado: una hoja o diálogo abierto, el teclado del PIN. La barrita y la ventana no se abren. */
export const hayAlgoEncima = () =>
  typeof document !== "undefined" && !!document.querySelector('[aria-modal="true"], [data-teclado-pin], [data-billetes]');
