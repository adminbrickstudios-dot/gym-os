import "server-only";
import { rpc } from "./servidor";

export type TablaVersion = "socios" | "planes" | "configuracion";

/** La versión actual de un registro (VD-34), o null si no se pudo leer: nunca frena un guardado. */
export async function versionDe(gimnasioId: string, tabla: TablaVersion, id: string): Promise<string | null> {
  try { return (await rpc<{ version: string }>("version_registro", { p_gimnasio_id: gimnasioId, p_tabla: tabla, p_id: id })).version; }
  catch { return null; }
}

export function haceCuanto(segundos: number): string {
  if (segundos < 60) return "hace unos segundos";
  const min = Math.round(segundos / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} días`;
}

/**
 * Si alguien cambió el registro desde que se abrió el formulario: el mensaje para mostrar y la
 * versión nueva. El próximo "Guardar" ya lleva esa versión y guarda igual (nunca se pisa en silencio).
 */
export async function conflictoDe(gimnasioId: string, tabla: TablaVersion, id: string, version: string | null | undefined): Promise<{ error: string; version: string } | null> {
  if (!version) return null;
  try {
    const r = await rpc<{ cambio: boolean; version: string; por?: string; hace_segundos?: number }>("verificar_version", { p_gimnasio_id: gimnasioId, p_tabla: tabla, p_id: id, p_version: version });
    if (!r.cambio) return null;
    return { version: r.version, error: `${r.por ?? "Alguien"} lo cambió ${haceCuanto(r.hace_segundos ?? 0)}. Recargá la página para ver lo nuevo, o tocá Guardar otra vez para guardar igual tus cambios.` };
  } catch { return null; }
}
