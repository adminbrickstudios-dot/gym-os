"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

/** COM-8: el evento se crea con su producto y su cupo (la base valida y decide quién puede). */
export async function crearEvento(d: { nombre: string; inicio: string; cupo: number; precio: number; descripcion: string; para: string }): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("crear_evento", { p_gimnasio_id: panel.gimnasio.id, p_nombre: d.nombre, p_inicio: d.inicio, p_cupo: d.cupo, p_precio: d.precio, p_descripcion: d.descripcion, p_para: d.para });
    revalidatePath("/panel/eventos"); revalidatePath("/panel/vender");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function cerrarEvento(id: string): Promise<{ error?: string }> {
  try { await rpc("cerrar_evento", { p_evento_id: id }); revalidatePath("/panel/eventos"); revalidatePath("/panel/vender"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
