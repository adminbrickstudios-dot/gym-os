"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

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
