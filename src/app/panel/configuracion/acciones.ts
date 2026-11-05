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

// ── Horarios y cierres ──────────────────────────────────────────────
export async function guardarHorarios(sedeId: string, franjas: { dia: number; abre: string; cierra: string }[]): Promise<{ error?: string; agenda?: unknown }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_horarios_apertura", { p_gimnasio_id: panel.gimnasio.id, p_sede_id: sedeId, p_franjas: franjas });
    revalidatePath("/", "layout");
    return { agenda: await rpc("horarios_apertura_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

/** El día siguiente a una fecha AAAA-MM-DD (la base guarda el cierre como [desde, hasta)). */
function diaSiguiente(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

async function listasDeCierres(gimnasioId: string) {
  const [cierres, agenda] = await Promise.all([
    rpc("cierres_panel", { p_gimnasio_id: gimnasioId }),
    rpc("horarios_apertura_panel", { p_gimnasio_id: gimnasioId }),
  ]);
  return { cierres, agenda };
}

export async function crearCierre(c: { desde: string; hasta: string; motivo: string; compensa: boolean; sedeId: string | null }): Promise<{ error?: string; cierres?: unknown; agenda?: unknown }> {
  const panel = await contextoPanel();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.desde) || !/^\d{4}-\d{2}-\d{2}$/.test(c.hasta)) return { error: "Elegí las fechas del cierre." };
  if (c.hasta < c.desde) return { error: "El último día no puede ser antes del primero." };
  try {
    await rpc("crear_cierre", {
      p_gimnasio_id: panel.gimnasio.id, p_desde: c.desde, p_hasta: diaSiguiente(c.hasta), p_motivo: c.motivo,
      p_compensa: c.compensa, p_sede_id: c.sedeId,
    });
    revalidatePath("/", "layout");
    return await listasDeCierres(panel.gimnasio.id);
  } catch (e) { return { error: (e as Error).message }; }
}

export async function anularCierre(cierreId: string, motivo: string): Promise<{ error?: string; cierres?: unknown; agenda?: unknown }> {
  const panel = await contextoPanel();
  try {
    await rpc("anular_cierre", { p_cierre_id: cierreId, p_motivo: motivo });
    revalidatePath("/", "layout");
    return await listasDeCierres(panel.gimnasio.id);
  } catch (e) { return { error: (e as Error).message }; }
}

// ── Mensajes ────────────────────────────────────────────────────────
export async function guardarMensaje(clave: string, texto: string): Promise<{ error?: string; mensajes?: unknown }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_mensaje", { p_gimnasio_id: panel.gimnasio.id, p_clave: clave, p_texto: texto });
    return { mensajes: await rpc("mensajes_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function restaurarMensaje(clave: string): Promise<{ error?: string; mensajes?: unknown }> {
  const panel = await contextoPanel();
  try {
    await rpc("restaurar_mensaje", { p_gimnasio_id: panel.gimnasio.id, p_clave: clave });
    return { mensajes: await rpc("mensajes_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

/** Cómo queda un texto (sin guardar) con un socio real. */
export async function vistaPreviaMensaje(clave: string, texto: string): Promise<{ error?: string; vista?: unknown }> {
  const panel = await contextoPanel();
  try {
    return { vista: await rpc("vista_previa_mensaje", { p_gimnasio_id: panel.gimnasio.id, p_clave: clave, p_texto: texto }) };
  } catch (e) { return { error: (e as Error).message }; }
}

// ── Página ──────────────────────────────────────────────────────────
export async function publicarPagina(publicada: boolean): Promise<{ error?: string; datos?: unknown }> {
  const panel = await contextoPanel();
  try {
    await rpc("publicar_pagina", { p_gimnasio_id: panel.gimnasio.id, p_publicada: publicada });
    revalidatePath("/", "layout");
    return { datos: await rpc("datos_gimnasio_panel", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}
