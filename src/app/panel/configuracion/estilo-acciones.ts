"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

/** Pase 2.0: el dueño elige el estilo del gimnasio (clásico o Pista) y el modo de Pista. La base verifica que sea el dueño; sin permiso, error. */
export async function guardarEstilo(estilo: string, modo: string): Promise<{ error?: string }> {
  try {
    const panel = await contextoPanel();
    await rpc<string>("guardar_estilo_gimnasio", { p_gimnasio_id: panel.gimnasio.id, p_estilo: estilo, p_modo: modo });
    revalidatePath("/panel", "layout");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
