"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

export async function unir(queda: string, seVa: string): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("unir_socios", { p_gimnasio_id: panel.gimnasio.id, p_queda: queda, p_se_va: seVa });
    revalidatePath("/panel/socios", "layout");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
