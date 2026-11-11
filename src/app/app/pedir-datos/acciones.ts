"use server";
import { rpc } from "@/lib/panel/servidor";

/** BASE-8 (Ley 25.326): el socio pide ver, corregir o borrar sus datos. Un pedido abierto por tipo; lo resuelve el dueño. */
export async function pedirMisDatos(socioId: string, tipo: string, detalle: string): Promise<{ error?: string }> {
  try {
    await rpc("pedir_mis_datos", { p_socio_id: socioId, p_tipo: tipo, p_detalle: detalle.trim() || null });
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
