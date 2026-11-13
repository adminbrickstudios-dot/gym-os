import "server-only";
import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { cache } from "react";
import { guardaLoPublico } from "@/lib/panel/lo-publico";
import { crearClienteServidor, gimnasioActual } from "@/lib/supabase/servidor";
import type { Rol } from "@/lib/panel/secciones";
import type { Abono } from "@/components/panel/Marco";
import type { ConfigEntrada } from "@/app/panel/entrada/config";

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
    const t0 = performance.now();
    const { data, error, status } = await supabase.rpc(nombre, args).abortSignal(AbortSignal.timeout(TIEMPO_MAXIMO_MS));
    // F0.1: cada viaje a la base queda en el log de Vercel con su nombre y sus ms (sin datos ni argumentos).
    console.log(`[rpc] ${nombre} ${Math.round(performance.now() - t0)}ms${error ? " error" : ""}`);
    if (!error) {
      if (!opciones.lectura && guardaLoPublico(nombre)) invalidarLoPublico();
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
function invalidarLoPublico() {
  try { revalidateTag("landing", { expire: 0 }); } catch { /* llamado durante el render: no se puede, vence solo en 60 s */ }
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
  permisos: { recepcion_ve_cobrado: boolean; recepcion_vende_productos: boolean; profe_ve_telefono: boolean; encargado_ve_resultado: boolean; encargado_ve_gastos?: boolean };
  sedes: { id: string; nombre: string; es_principal: boolean }[];
};

export type MiSesion = {
  usuario_id: string;
  es_admin: boolean;
  equipo: { equipo_id: string; gimnasio_id: string; slug: string; gimnasio: string; rol: Rol; sede_id: string | null; nombre: string }[];
  socios: { socio_id: string; gimnasio_id: string; slug: string; gimnasio: string; nombre: string }[];
};

/**
 * F0.2: TODO lo que el panel necesita para pintar sale de una sola llamada a la base (contexto_pantalla): antes eran seis viajes,
 * tres en fila. Lo comparten contextoPanel (el menú, los permisos) y el layout (abono, Entrada).
 */
export type ContextoCompleto = {
  panel: PanelGimnasio;
  ver_mensajes?: boolean; fichaje_usa?: boolean;
  abono?: Abono | null; config_entrada?: ConfigEntrada | null; formas_entrada?: string[] | null;
  /** E8: pausado / baja / demo vencida, y el WhatsApp de ayuda (dueño, encargado, recepción): antes dos viajes más en fila en el layout. */
  estado_gimnasio?: { pausado: boolean; baja: boolean; demo_vencida: boolean; whatsapp_brik: string | null } | null;
  contacto_plataforma?: { whatsapp: string | null; mensaje_demo?: string | null } | null;
};
export const contextoCompleto = cache(async (): Promise<ContextoCompleto> => {
  const g = await gimnasioActual();
  const supabase = await crearClienteServidor();
  // getClaims: sin viaje a Auth cuando hay claves asimétricas; la base valida con auth.uid() igual.
  const [claims0, res] = await Promise.all([
    supabase.auth.getClaims(),
    rpcLectura<ContextoCompleto>("contexto_pantalla", { p_gimnasio_id: g.id }).then((v) => ({ v }), (e: unknown) => ({ e })),
  ]);
  // Sesión: solo "no hay sesión" manda al ingreso. Si la verificación FALLÓ (error de red o del servicio de cuentas) se reintenta una vez;
  // si sigue fallando se dice (nunca se echa a alguien con sesión por un tropiezo del servicio de cuentas).
  let claims = claims0;
  if (!claims.data?.claims?.sub && claims.error) { await new Promise((r) => setTimeout(r, 200)); claims = await supabase.auth.getClaims(); }
  if (!claims.data?.claims?.sub) {
    if (claims.error && !/session.*missing|no.*session|not.*authenticated|jwt/i.test(claims.error.message ?? "")) {
      console.error(`[sesion] getClaims fallo: ${claims.error.message}`);
      throw new ErrorDatos("No pudimos verificar tu sesión ahora. Probá de nuevo en un momento.", "sesion", 503);
    }
    redirect("/ingresar?siguiente=/panel");
  }
  if ("e" in res) throw res.e;
  return res.v;
});

/** El contexto de cualquier pantalla del panel. Sin sesión → /ingresar. Sin permiso → error, no un panel vacío. */
export const contextoPanel = cache(async (): Promise<PanelGimnasio> => {
  const c = await contextoCompleto();
  let panel = c.panel;
  // VD-38: los Mensajes de los socios los ve la recepción solo si el dueño se lo prendió (tabla propia: panel_gimnasio no se toca).
  // La base lo exige igual en cada función; acá solo se saca del menú, de Ctrl+K y de los accesos. Solo la recepción pregunta.
  if (panel.yo.rol === "recepcion" && !panel.secciones_apagadas.includes("mensajes") && !c.ver_mensajes) {
    panel = { ...panel, secciones_apagadas: [...panel.secciones_apagadas, "mensajes"] };
  }
  // VD-10: el Control es del dueño; el encargado lo ve solo si el dueño le dio el Resultado (EQU-1).
  // La base lo exige igual (linea_de_control): acá solo se saca del menú y de la campana.
  if (panel.yo.rol === "encargado" && !panel.permisos.encargado_ve_resultado && !panel.secciones_apagadas.includes("control")) {
    panel = { ...panel, secciones_apagadas: [...panel.secciones_apagadas, "control"] };
  }
  // VD-53: el fichaje es opcional (por defecto apagado). Fichar y las Horas del equipo solo aparecen si el gimnasio lo prendió;
  // el dueño ve siempre las Horas (ahí lo prende). La base lo exige igual en cada función.
  if (panel.yo.rol !== "dueno") {
    if (!c.fichaje_usa) panel = { ...panel, secciones_apagadas: [...panel.secciones_apagadas, "fichar", "horas"] };
  }
  return panel;
});

/** Corta si el rol no puede ver la pantalla: error claro, no una lista vacía. */
export function exigirRol(panel: PanelGimnasio, roles: Rol[]) {
  if (!roles.includes(panel.yo.rol)) throw new ErrorDatos(`Tu rol (${panel.yo.rol}) no tiene acceso a esta pantalla. Si lo necesitás, pedíselo al dueño.`, "42501", 403);
}

/** Una sección que el gimnasio apagó no se ve en ningún panel, ni entrando por la dirección. */
export function exigirSeccion(panel: PanelGimnasio, clave: string) {
  if (panel.secciones_apagadas.includes(clave)) {
    // Gastos se apaga solo para quien no tiene el permiso (VD-41b): se dice que es un permiso, no que el gimnasio la apagó.
    if (clave === "gastos" && panel.yo.rol !== "dueno") throw new ErrorDatos("No tenés permiso para ver los gastos. Pedíselo al dueño.", "42501", 403);
    // Igual con Mensajes para la recepción (VD-38): la saca del menú el permiso que da el dueño, no que el gimnasio la haya apagado.
    if (clave === "mensajes" && panel.yo.rol === "recepcion") throw new ErrorDatos("No tenés permiso para ver los mensajes de los socios. Pedíselo al dueño.", "42501", 403);
    throw new ErrorDatos("Esta sección está apagada en este gimnasio. La prende el dueño desde Configuración.", "apagada", 404);
  }
}
