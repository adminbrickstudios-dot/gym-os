"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

/** VD-12: el dueño elige hasta 4 números del Inicio. La base valida el rol y las claves. */
export async function guardarNumerosInicio(claves: string[]): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_numeros_inicio", { p_gimnasio_id: panel.gimnasio.id, p_claves: claves });
    revalidatePath("/panel");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
