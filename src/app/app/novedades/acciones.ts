"use server";
import { gimnasioActual } from "@/lib/supabase/servidor";
import { rpc } from "@/lib/panel/servidor";

export async function leerNovedades(claves: string[]): Promise<{ error?: string }> {
  try {
    const g = await gimnasioActual();
    await rpc("leer_campana", { p_gimnasio_id: g.id, p_claves: claves.slice(0, 300) });
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
