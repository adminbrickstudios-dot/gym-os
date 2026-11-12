// H3: qué hace el proxy con un pedido a la dirección de la plataforma (sin subdominio).
// Función pura, sin red ni cookies: se prueba con vitest (proxy-rutas.test.ts). El proxy resuelve el gimnasio y aplica lo que acá se decide.
import { subdominiosFuncionan } from "@/lib/dominios";
import { normalizarHost } from "@/lib/host";

/** Rutas públicas de un gimnasio que se quedan en la dirección /g/<slug>/…: se sirven con el gimnasio marcado, sin rebotar a la raíz de la plataforma. */
export const PUBLICAS_DEL_GIMNASIO = ["/ingresar", "/hacete-socio", "/privacidad", "/terminos"] as const;

/** Rutas de la plataforma que, si ya hay un gimnasio elegido (cookie), se sirven con ese gimnasio: los links relativos de su página siguen andando. */
export const CON_GIMNASIO_ELEGIDO = ["/hacete-socio", "/privacidad", "/terminos"] as const;

export type DeRuta =
  | { tipo: "gimnasio"; slug: string; resto: string | null }   // /g/<slug> o /g/<slug>/<resto>
  | { tipo: "ninguna" };

/** "/g/templegym1/hacete-socio/" → { slug: "templegym1", resto: "/hacete-socio" }. Sin resto o solo "/": resto null. */
export function leerRutaGimnasio(ruta: string): DeRuta {
  const m = /^\/g\/([a-z0-9-]{1,42})(\/.*)?$/.exec(ruta);
  if (!m) return { tipo: "ninguna" };
  const resto = (m[2] ?? "").replace(/\/+$/, "");
  return { tipo: "gimnasio", slug: m[1], resto: resto === "" ? null : resto };
}

export type AccionGimnasio =
  | { accion: "raiz" }                          // la landing del gimnasio (rewrite a "/")
  | { accion: "publica"; ruta: string }         // una ruta pública del gimnasio, en su dirección (rewrite)
  | { accion: "redirigir"; ruta: string };      // panel, app, auth…: van a la ruta de la plataforma con el gimnasio en la cookie

export function accionDeGimnasio(resto: string | null): AccionGimnasio {
  if (!resto) return { accion: "raiz" };
  const r = PUBLICAS_DEL_GIMNASIO.find((p) => resto === p);
  if (r) return { accion: "publica", ruta: r };
  return { accion: "redirigir", ruta: resto };
}

/**
 * ¿La dirección /g/<slug> tiene que mandar a la dirección propia del gimnasio? Solo si esa dirección anda: un dominio propio, o un
 * subdominio cuando el dominio base tiene comodín. Si no (hoy: *.vercel.app), /g/<slug>/… es la dirección buena y SIEMPRE anda.
 */
export function direccionPropia(host: string | null | undefined, opc: { base: string; plataforma: string }): string | null {
  const h = normalizarHost(host);
  if (!h || h === normalizarHost(opc.plataforma) || h === normalizarHost(opc.base)) return null;
  const base = normalizarHost(opc.base);
  const esSubdominio = !!base && h.endsWith(`.${base}`);
  // En la compu (localhost) los subdominios existen pero con otro puerto: ahí /g/<slug> sigue siendo la dirección.
  const local = base === "localhost" || base.endsWith(".localhost");
  if (esSubdominio && (!subdominiosFuncionan(base) || local)) return null;
  if (/^(localhost|127\.\d+\.\d+\.\d+)$|\.localhost$/.test(h)) return null;
  return h;
}

/** ¿Una ruta de la plataforma que usa el gimnasio elegido por cookie? (/hacete-socio, /privacidad, el ingreso del socio). */
export function usaGimnasioElegido(ruta: string, modo: string | null): boolean {
  if ((CON_GIMNASIO_ELEGIDO as readonly string[]).includes(ruta)) return true;
  return ruta === "/ingresar" && modo === "socio";
}

/** ¿Es del gimnasio elegido y además pide sesión (el panel, la app y /auth)? */
export function esDelGimnasioConSesion(ruta: string): boolean {
  return ruta === "/panel" || ruta.startsWith("/panel/") || ruta === "/app" || ruta.startsWith("/app/") || ruta.startsWith("/auth/");
}
