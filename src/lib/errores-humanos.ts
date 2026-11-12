/**
 * TEXTO (Z4): al socio y a la recepción nunca se les muestra el `message` crudo de la base o de Supabase ("duplicate key…", "JWT expired").
 * Se le dice qué pasó y qué hacer en palabras, y el detalle original queda en el log del servidor para encontrarlo después (FLUIDEZ regla 19).
 */
export function sinDetalle(texto: string, original: unknown): string {
  console.error(`[error] ${texto}`, original);
  return texto;
}

/** Códigos con los que la base escribe sus propios `raise exception` pensados para la persona (en español). */
const CODIGOS_PROPIOS = new Set(["P0001", "P0002", "22023", "42501"]);
/** Lo crudo de Postgres o PostgREST, aunque venga con uno de esos códigos ("permission denied for table…"). */
const CRUDO = /violates|duplicate key|permission denied|does not exist|syntax error|invalid input|JWT|PGRST|row-level security|null value in column|fetch failed|timeout|connection/i;

/**
 * Un texto para la persona a partir de un error de la base: lo que escribimos nosotros (`raise exception` con P0001, P0002, 22023 o 42501)
 * ya está en español y se muestra; lo crudo ("duplicate key", "JWT expired", códigos de sistema, un 500 de red) va al registro y la persona ve `generico`.
 */
export function textoDeBase(e: { message?: string; code?: string } | null | undefined, generico = "No pudimos hacerlo ahora. Probá de nuevo en un rato."): string {
  if (e?.message && e.code && CODIGOS_PROPIOS.has(e.code) && !CRUDO.test(e.message)) return e.message;
  console.error("[error de la base]", e?.code, e?.message);
  return generico;
}
