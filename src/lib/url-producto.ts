import { supabaseUrl } from "@/lib/entorno";

/** URL pública de la foto de un producto (bucket "fotos_productos"; sirve en el servidor y en el navegador). */
export function urlFotoProducto(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  return `${supabaseUrl()}/storage/v1/object/public/fotos_productos/${ruta.split("/").map(encodeURIComponent).join("/")}`;
}
