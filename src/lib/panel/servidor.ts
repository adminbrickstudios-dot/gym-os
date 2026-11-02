import "server-only";
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
export async function rpc<T>(nombre: string, args?: Record<string, unknown>): Promise<T> {
  const supabase = await crearClienteServidor();
  const { data, error, status } = await supabase.rpc(nombre, args);
  if (error) throw new ErrorDatos(error.message, error.code, status);
  return data as T;
}

export type PanelGimnasio = {
  gimnasio: { id: string; slug: string; nombre: string; zona_horaria: string };
  marca: { logo_path: string | null; favicon_path: string | null; color_acento: string; color_fondo: string };
  yo: { equipo_id: string; nombre: string; rol: Rol; sede_id: string | null; accesos: string[] | null };
  secciones_apagadas: string[];
  modo_clases: "reserva" | "sin_reserva" | "ninguno";
  cobra: { membresia: boolean; pase: boolean; pack: boolean };
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
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/ingresar?siguiente=/panel");
  return rpc<PanelGimnasio>("panel_gimnasio", { p_gimnasio_id: g.id });
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
