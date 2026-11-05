import { supabaseUrl } from "@/lib/entorno";

/** URL pública de un archivo del bucket "marcas" (sirve en el servidor y en el navegador). */
export function urlMarca(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  if (/^https:\/\//.test(ruta)) return ruta;
  return `${supabaseUrl()}/storage/v1/object/public/marcas/${ruta.split("/").map(encodeURIComponent).join("/")}`;
}
