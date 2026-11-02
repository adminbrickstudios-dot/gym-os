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
