"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

/** COM-9: el cupón lo crea el dueño (lo decide la base). */
export async function guardarCupon(d: { codigo: string; tipo: string; valor: number; tope: number | null; vence: string | null; planes: string[] }): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_cupon", { p_gimnasio_id: panel.gimnasio.id, p_codigo: d.codigo, p_tipo: d.tipo, p_valor: d.valor, p_tope_usos: d.tope, p_vence: d.vence, p_planes: d.planes });
    revalidatePath("/panel/cupones");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function desactivarCupon(id: string): Promise<{ error?: string }> {
  try { await rpc("desactivar_cupon", { p_cupon_id: id }); revalidatePath("/panel/cupones"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
