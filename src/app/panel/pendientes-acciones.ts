"use server";
import { rpc } from "@/lib/panel/servidor";
import { gimnasioActual } from "@/lib/supabase/servidor";
import type { Pendientes } from "@/lib/panel/pendientes";

/** Todos los contadores del menú en un pedido. Si falla devuelve null: el menú no muestra un cero que no es. */
export async function traerPendientes(): Promise<Pendientes | null> {
  try {
    const g = await gimnasioActual();
    return await rpc<Pendientes>("pendientes_panel", { p_gimnasio_id: g.id }, { lectura: true });
  } catch { return null; }
}
