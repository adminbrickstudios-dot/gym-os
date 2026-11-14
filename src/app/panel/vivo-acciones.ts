"use server";
// E8 · Lo que el panel pide después de pintar cada pantalla, en UN pedido y UN viaje a la base (panel_vivo): los números del menú y
// el número de la campana. Si la base todavía no tiene la función (el código salió antes que la migración), se piden por separado como antes.
import { rpc } from "@/lib/panel/servidor";
import { gimnasioActual } from "@/lib/supabase/servidor";
import type { Pendientes } from "@/lib/panel/pendientes";
import { armarItemsCampana, type ItemCampana } from "./campana/datos";
import { traerPendientes } from "./pendientes-acciones";
import { contarCampana } from "./campana/acciones";

export type Vivo = { pendientes: Pendientes | null; sinLeer: number | null };

export async function traerVivo(ctx: { rol: string; apagadas: string[] }): Promise<Vivo | null> {
  try {
    const g = await gimnasioActual();
    const r = await rpc<{ pendientes: Pendientes; campana: { items: ItemCampana[] }; mp: { items: Omit<ItemCampana, "tipo">[] } | null }>("panel_vivo", { p_gimnasio_id: g.id }, { lectura: true });
    const mp = ctx.rol === "dueno" || ctx.rol === "encargado" ? (r.mp?.items ?? []) : [];
    const items = armarItemsCampana(r.campana.items, mp, ctx.rol, ctx.apagadas);
    return { pendientes: r.pendientes, sinLeer: items.filter((i) => !i.leido).length };
  } catch (e) {
    if (!/panel_vivo/.test((e as Error).message ?? "")) return null;
    const [pendientes, sinLeer] = await Promise.all([traerPendientes(), contarCampana(ctx)]);
    return { pendientes, sinLeer };
  }
}
