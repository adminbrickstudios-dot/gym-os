"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

/**
 * Pase 2.0: el dueño elige el modo de Pista (oscuro o claro). Pista es el único estilo desde el 26/11: el estilo se manda siempre "pista" mientras
 * la base tenga la columna (la saca la publicación B). La base verifica que sea el dueño; sin permiso, error.
 */
export async function guardarModo(modo: string): Promise<{ error?: string }> {
  try {
    const panel = await contextoPanel();
    await rpc<string>("guardar_estilo_gimnasio", { p_gimnasio_id: panel.gimnasio.id, p_estilo: "pista", p_modo: modo });
    revalidatePath("/panel", "layout");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
