// Resolución del host: ¿es la plataforma (BRIK) o un gimnasio?
// Sin fallback silencioso: un host que no es de nadie va a
// /gimnasio-no-encontrado con la dirección escrita.

export type ClaseHost =
  | { tipo: "plataforma" }
  | { tipo: "gimnasio"; host: string };

/** Minúsculas, sin protocolo, sin ruta, sin puerto, sin punto final ("https://Ejemplo.com/" → "ejemplo.com"). */
export function normalizarHost(crudo: string | null | undefined): string {
  return (crudo ?? "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
}

/**
 * - El dominio de la plataforma (y www del dominio base) → plataforma.
 * - Cualquier otro host (subdominio del base o dominio propio) → gimnasio,
 *   que se busca por host exacto en dominios_gimnasio.
 */
export function clasificarHost(host: string, dominioBase: string, dominioPlataforma: string): ClaseHost {
  const h = normalizarHost(host);
  const base = normalizarHost(dominioBase);
  const plataforma = normalizarHost(dominioPlataforma);
  if (!h) return { tipo: "gimnasio", host: h };
  if (h === plataforma || h === base || h === `www.${base}`) return { tipo: "plataforma" };
  return { tipo: "gimnasio", host: h };
}
