"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import type { EntradaVivo } from "@/components/panel/UltimasEntradas";

/** VD-12b: renueva las últimas entradas de hoy (la base filtra por rol y sede). */
export async function ultimasEntradas(): Promise<{ error?: string; entradas?: EntradaVivo[] }> {
  try {
    const panel = await contextoPanel();
    return { entradas: await rpc<EntradaVivo[]>("ultimas_entradas", { p_gimnasio_id: panel.gimnasio.id, p_limite: 8 }, { lectura: true }) };
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-12: el dueño elige hasta 4 números del Inicio. La base valida el rol y las claves. */
export async function guardarNumerosInicio(claves: string[]): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_numeros_inicio", { p_gimnasio_id: panel.gimnasio.id, p_claves: claves });
    revalidatePath("/panel");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
