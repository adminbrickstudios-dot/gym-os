/**
 * TEXTO (Z4): al socio y a la recepción nunca se les muestra el `message` crudo de la base o de Supabase ("duplicate key…", "JWT expired").
 * Se le dice qué pasó y qué hacer en palabras, y el detalle original queda en el log del servidor para encontrarlo después (FLUIDEZ regla 19).
 */
export function sinDetalle(texto: string, original: unknown): string {
  console.error(`[error] ${texto}`, original);
  return texto;
}
