// F9.4 (ESC-02) · Propuesta para el proxy (carril A, NO aplicada): qué pedidos públicos pueden servirse desde la caché de la red.
// Función pura, sin red ni cookies: el proxy le pasa la ruta y los nombres de las cookies y ella dice a qué ruta de ISR reescribir.
// Un pedido con cualquier cookie de sesión (sb-*) o de gimnasio elegido sigue como hoy: nunca se cachea algo que depende de quién mira.

/** Rutas públicas de un gimnasio que tienen su versión cacheada (`/sitio/<host>/…`, con `revalidate`). */
export const CACHEABLES = ["/", "/hacete-socio", "/privacidad", "/terminos"] as const;

/** ¿Es una cookie que cambia lo que se ve? Cualquiera de Supabase Auth (sb-…) o la del gimnasio elegido. */
export function cookieQueCambia(nombre: string): boolean {
  return nombre.startsWith("sb-") || nombre === "gymos_gimnasio" || nombre === "tema";
}

/**
 * Ruta de ISR para un pedido público: `/sitio/<host>` + la ruta, o null si el pedido no se puede cachear
 * (otra ruta, un POST, con cookies que cambian la vista, o con parámetros de búsqueda como ?ref=).
 */
export function rutaSitioCacheable(opc: { host: string; ruta: string; metodo: string; cookies: string[]; busqueda: string }): string | null {
  if (opc.metodo !== "GET" && opc.metodo !== "HEAD") return null;
  if (opc.busqueda) return null;
  if (opc.cookies.some(cookieQueCambia)) return null;
  const ruta = opc.ruta.replace(/\/+$/, "") || "/";
  if (!(CACHEABLES as readonly string[]).includes(ruta)) return null;
  if (!/^[a-z0-9.-]{1,253}$/.test(opc.host)) return null;
  return `/sitio/${opc.host}${ruta === "/" ? "" : ruta}`;
}
