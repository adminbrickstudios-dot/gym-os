// P4 (EDIT-S01): la dirección de un gimnasio. Se normaliza SIEMPRE en el servidor (el navegador ayuda, pero no manda):
// minúsculas, sin tildes ni espacios, solo letras, números y guiones, hasta 40 caracteres.

/** Nombres que son de la plataforma y no puede tener un gimnasio (colisionarían con rutas o subdominios). */
export const SLUGS_RESERVADOS = new Set([
  "www", "admin", "super", "api", "app", "panel", "g", "ingresar", "salir", "auth", "hacete-socio", "kiosco", "tv", "mail", "ftp",
  "dueno", "recepcion", "profe", "socio", "base", "brik", "static", "assets", "demo-box",
]);

export function normalizarSlug(texto: string): string {
  return String(texto ?? "")
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 40).replace(/-+$/g, "");
}

export const slugValido = (s: string) => /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(s);

/** Devuelve el mensaje de error si la dirección no sirve, o null si está bien. */
export function errorDeSlug(slug: string): string | null {
  if (!slug) return "Escribí el nombre del gimnasio: de ahí sale su dirección.";
  if (!slugValido(slug)) return "La dirección va en minúsculas, sin espacios ni tildes (ej: olympo-gym).";
  if (SLUGS_RESERVADOS.has(slug)) return `“${slug}” es una dirección de la plataforma: elegí otra.`;
  return null;
}
