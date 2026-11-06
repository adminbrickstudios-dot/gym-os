import "server-only";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { cache } from "react";
import { crearClienteServidor, gimnasioActual } from "@/lib/supabase/servidor";
import type { Rol } from "@/lib/panel/secciones";

/** Error de una función de la base, con el mensaje que la base escribió para mostrar. */
export class ErrorDatos extends Error {
  constructor(mensaje: string, readonly codigo?: string, readonly estado?: number) {
    super(mensaje);
  }
  get sinPermiso() { return this.codigo === "42501" || this.estado === 403; }
}

/**
 * Llama a una función de public. Nunca devuelve vacío ante un error: lo tira,
 * con el texto de la base ("Sin permiso…", "El DNI…").
 */
export async function rpc<T>(nombre: string, args?: Record<string, unknown>, opciones: { lectura?: boolean; operador?: string } = {}): Promise<T> {
  const supabase = await crearClienteServidor(opciones.operador);
  // VD-47: tiempo máximo de 10 s. Solo una LECTURA se reintenta (una vez); una escritura nunca se
  // repite sola (podría cobrar dos veces): ante la demora, se avisa y la persona decide.
  const intentos = opciones.lectura ? 2 : 1;
  for (let i = 1; ; i++) {
    const { data, error, status } = await supabase.rpc(nombre, args).abortSignal(AbortSignal.timeout(TIEMPO_MAXIMO_MS));
    if (!error) {
      if (!opciones.lectura && GUARDA_LO_PUBLICO.test(nombre)) invalidarLoPublico();
      return data as T;
    }
    if (esDemora(error)) {
      if (i < intentos) continue;
      throw new ErrorDatos("La base está tardando — Reintentar", "demora", 504);
    }
    throw new ErrorDatos(error.message, error.code, status);
  }
}

export const TIEMPO_MAXIMO_MS = 10_000;

// VD-47: la landing, la marca, los planes y los horarios públicos se guardan en caché (lib/landing.ts,
// etiqueta "landing"). Cualquier escritura que cambie eso la invalida al instante. Sobra invalidar de más
// (cuesta una consulta); falta invalidar nunca.
const GUARDA_LO_PUBLICO = /^(guardar|publicar|programar|aplicar|anular_precio|anular_cierre|crear_cierre|confirmar_imagen|quitar_imagen|ordenar_fotos|sumar_sede|configurar|archivar|reordenar|activar|desactivar|apagar|prender|editar)_/;
function invalidarLoPublico() {
  try { revalidateTag("landing"); } catch { /* llamado durante el render: no se puede, vence solo en 60 s */ }
}
/** Cortada por el tiempo máximo (AbortError / TimeoutError que supabase-js devuelve como error). */
const esDemora = (e: { message?: string; name?: string; code?: string }) =>
  /abort|timeout|timed out|aborted/i.test(`${e.name ?? ""} ${e.message ?? ""}`) && e.code !== "42501";

/** Una lectura: si la red o la base tardan, se pide una vez más. Nunca para escrituras. */
export const rpcLectura = <T,>(nombre: string, args?: Record<string, unknown>) => rpc<T>(nombre, args, { lectura: true });

export type PanelGimnasio = {
  gimnasio: { id: string; slug: string; nombre: string; zona_horaria: string };
  marca: { logo_path: string | null; favicon_path: string | null; color_acento: string; color_fondo: string };
  yo: { equipo_id: string; nombre: string; rol: Rol; sede_id: string | null; accesos: string[] | null };
  secciones_apagadas: string[];
  modo_clases: "reserva" | "sin_reserva" | "ninguno";
  cobra: { membresia: boolean; pase: boolean; pack: boolean };
  /** EQU-1 (D4): los interruptores del dueño. */
  permisos: { recepcion_ve_cobrado: boolean; recepcion_vende_productos: boolean; profe_ve_telefono: boolean; encargado_ve_resultado: boolean };
  sedes: { id: string; nombre: string; es_principal: boolean }[];
};

export type MiSesion = {
  usuario_id: string;
  es_admin: boolean;
  equipo: { equipo_id: string; gimnasio_id: string; slug: string; gimnasio: string; rol: Rol; sede_id: string | null; nombre: string }[];
  socios: { socio_id: string; gimnasio_id: string; slug: string; gimnasio: string; nombre: string }[];
};

/** El contexto de cualquier pantalla del panel. Sin sesión → /ingresar. Sin permiso → error, no un panel vacío. */
export const contextoPanel = cache(async (): Promise<PanelGimnasio> => {
  const g = await gimnasioActual();
  const supabase = await crearClienteServidor();
  // getClaims: sin viaje a Auth cuando hay claves asimétricas; la base valida con auth.uid() igual.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/ingresar?siguiente=/panel");
  return rpcLectura<PanelGimnasio>("panel_gimnasio", { p_gimnasio_id: g.id });
});

/** Corta si el rol no puede ver la pantalla: error claro, no una lista vacía. */
export function exigirRol(panel: PanelGimnasio, roles: Rol[]) {
  if (!roles.includes(panel.yo.rol)) throw new ErrorDatos("Tu rol no tiene acceso a esta pantalla", "42501", 403);
}

/** Una sección que el gimnasio apagó no se ve en ningún panel, ni entrando por la dirección. */
export function exigirSeccion(panel: PanelGimnasio, clave: string) {
  if (panel.secciones_apagadas.includes(clave)) {
    throw new ErrorDatos("Esta sección está apagada en este gimnasio. La prende el dueño desde Configuración.", "apagada", 404);
  }
}
