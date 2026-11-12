/**
 * TEXTO (Z4): al socio y a la recepción nunca se les muestra el `message` crudo de la base o de Supabase ("duplicate key…", "JWT expired").
 * Se le dice qué pasó y qué hacer en palabras, y el detalle original queda en el log del servidor para encontrarlo después (FLUIDEZ regla 19).
 */
export function sinDetalle(texto: string, original: unknown): string {
  console.error(`[error] ${texto}`, original);
  return texto;
}

/**
 * Un texto para la persona a partir de un error de la base: lo que escribimos nosotros (`raise exception`, código P0001) ya está en
 * español y se muestra; cualquier otra cosa ("duplicate key", "JWT expired", un 500 de red) va al registro y la persona ve `generico`.
 */
export function textoDeBase(e: { message?: string; code?: string } | null | undefined, generico = "No pudimos hacerlo ahora. Probá de nuevo en un rato."): string {
  if (e?.code === "P0001" && e.message) return e.message;
  console.error("[error de la base]", e?.code, e?.message);
  return generico;
}
