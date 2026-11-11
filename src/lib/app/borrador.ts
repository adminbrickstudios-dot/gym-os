// FA-17 · Borrador automático de los formularios largos. Se guarda SOLO en el dispositivo (localStorage), nunca en la base,
// y vence a los 7 días. Lo puro está acá (se prueba con un almacenamiento falso); el componente que lo usa en el
// formulario es `BorradorAutomatico.tsx` (misma carpeta; los formularios de otras pantallas lo importan de acá). Nunca guarda contraseñas ni el "acepto" del reglamento.

export const VENCE_BORRADOR_MS = 7 * 24 * 3600 * 1000;
const PREFIJO = "base:borrador:";
/** Campos que jamás se guardan: aceptar el reglamento tiene que ser un acto de ahora, y las contraseñas no van a ningún lado. */
const PROHIBIDOS = /^(acepto|sitio|contrasena|contrasena_elegida|repetir|password|codigo)$/i;

export type Borrador = { guardado: number; campos: Record<string, string> };
type Almacen = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Los campos que valen la pena guardar: texto con algo escrito y no prohibido. */
export function camposGuardables(campos: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(campos).filter(([k, v]) => !PROHIBIDOS.test(k) && typeof v === "string" && v.trim() !== ""));
}

export function guardarBorrador(almacen: Almacen | null, clave: string, campos: Record<string, string>, ahora = Date.now()): boolean {
  if (!almacen) return false;
  const limpios = camposGuardables(campos);
  try {
    if (Object.keys(limpios).length === 0) { almacen.removeItem(PREFIJO + clave); return false; }
    almacen.setItem(PREFIJO + clave, JSON.stringify({ guardado: ahora, campos: limpios } satisfies Borrador));
    return true;
  } catch { return false; }   // sin almacenamiento (ventana privada, lleno): el formulario anda igual, sin borrador
}

export function leerBorrador(almacen: Almacen | null, clave: string, ahora = Date.now()): Borrador | null {
  if (!almacen) return null;
  try {
    const crudo = almacen.getItem(PREFIJO + clave);
    if (!crudo) return null;
    const b = JSON.parse(crudo) as Borrador;
    if (!b || typeof b.guardado !== "number" || typeof b.campos !== "object" || b.campos === null) { almacen.removeItem(PREFIJO + clave); return null; }
    if (ahora - b.guardado > VENCE_BORRADOR_MS) { almacen.removeItem(PREFIJO + clave); return null; }
    const campos = camposGuardables(Object.fromEntries(Object.entries(b.campos).filter(([, v]) => typeof v === "string")));
    return Object.keys(campos).length ? { guardado: b.guardado, campos } : null;
  } catch { return null; }
}

export function borrarBorrador(almacen: Almacen | null, clave: string) {
  try { almacen?.removeItem(PREFIJO + clave); } catch { /* nada que borrar */ }
}
