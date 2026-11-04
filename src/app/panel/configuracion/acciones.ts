"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { clienteServicio } from "@/lib/supabase/servicio";
import { svgSeguro, tipoReal } from "@/lib/imagenes";

export async function guardarConfiguracion(datos: Record<string, unknown>): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_configuracion", { p_gimnasio_id: panel.gimnasio.id, p_datos: datos });
    revalidatePath("/panel", "layout");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/**
 * Pestaña Gimnasio: nombre, contacto y sedes, todo junto o nada. Devuelve lo
 * guardado tal como quedó en la base (teléfonos e Instagram normalizados).
 */
export async function guardarDatosGimnasio(datos: Record<string, unknown>): Promise<{ error?: string; datos?: unknown }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_datos_gimnasio", { p_gimnasio_id: panel.gimnasio.id, p_datos: datos });
    revalidatePath("/panel", "layout");
    return { datos: await rpc("datos_gimnasio_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

// ── Logo, ícono y fotos ─────────────────────────────────────────────
// La base decide (permiso, tipo, tamaño, cupo, ruta); recién después el
// servidor sube o borra con la clave de servicio. El navegador nunca
// escribe en el bucket.
type TipoImagen = "logo" | "favicon" | "foto";
const TIPOS: TipoImagen[] = ["logo", "favicon", "foto"];

async function borrarArchivos(rutas: (string | null | undefined)[]) {
  const r = rutas.filter((x): x is string => !!x);
  if (!r.length) return;
  // Si falla, queda un archivo sin usar en el bucket: no rompe nada y no se le muestra a nadie.
  const { error } = await clienteServicio().storage.from("marcas").remove(r);
  if (error) console.error(`No se pudo borrar ${r.join(", ")}: ${error.message}`);
}

export async function subirImagen(formulario: FormData): Promise<{ error?: string; datos?: unknown }> {
  const panel = await contextoPanel();
  const tipo = formulario.get("tipo") as TipoImagen;
  const archivo = formulario.get("archivo");
  if (!TIPOS.includes(tipo) || !(archivo instanceof File)) return { error: "Elegí un archivo." };
  try {
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const mime = tipoReal(bytes);
    if (!mime) return { error: `“${archivo.name}” no es una imagen que podamos usar (PNG, JPG, WEBP o SVG).` };
    if (mime === "image/svg+xml" && !svgSeguro(new TextDecoder().decode(bytes))) {
      return { error: "Ese SVG trae código o links adentro y no lo podemos mostrar. Exportalo de nuevo como PNG." };
    }
    const ruta = await rpc<string>("preparar_imagen_marca", { p_gimnasio_id: panel.gimnasio.id, p_tipo: tipo, p_tipo_mime: mime, p_bytes: bytes.length });
    const { error } = await clienteServicio().storage.from("marcas").upload(ruta, Buffer.from(bytes), { contentType: mime, upsert: false, cacheControl: "31536000" });
    if (error) return { error: `No se pudo subir la imagen: ${error.message}` };
    let anterior: string | null;
    try {
      anterior = await rpc<string | null>("confirmar_imagen_marca", { p_gimnasio_id: panel.gimnasio.id, p_tipo: tipo, p_ruta: ruta });
    } catch (e) {
      await borrarArchivos([ruta]);
      throw e;
    }
    await borrarArchivos([anterior]);
    revalidatePath("/", "layout");
    return { datos: await rpc("datos_gimnasio_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function quitarImagen(tipo: TipoImagen, ruta?: string): Promise<{ error?: string; datos?: unknown }> {
  const panel = await contextoPanel();
  try {
    const sobra = await rpc<string | null>("quitar_imagen_marca", { p_gimnasio_id: panel.gimnasio.id, p_tipo: tipo, p_ruta: ruta ?? null });
    await borrarArchivos([sobra]);
    revalidatePath("/", "layout");
    return { datos: await rpc("datos_gimnasio_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function ordenarFotos(rutas: string[]): Promise<{ error?: string; datos?: unknown }> {
  const panel = await contextoPanel();
  try {
    await rpc("ordenar_fotos", { p_gimnasio_id: panel.gimnasio.id, p_rutas: rutas });
    revalidatePath("/", "layout");
    return { datos: await rpc("datos_gimnasio_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}
