"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";
import type { Veredicto } from "@/app/panel/entrada/acciones";
import type { PreciosVenta } from "./tipos";

export async function preciosPara(sedeId: string, socioId: string | null): Promise<{ precios?: PreciosVenta; error?: string }> {
  const panel = await contextoPanel();
  try {
    const { sede } = sedeActiva(panel, sedeId);
    return { precios: await rpc<PreciosVenta>("precios_venta", { p_sede_id: sede.id, p_socio_id: socioId }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export type Venta = { venta_id: string; total: number; veredicto: Veredicto | null };

export async function cobrar(datos: {
  sedeId: string; socioId: string | null; turnoId: string | null;
  items: Record<string, unknown>[]; pagos: { medio: string; monto: number }[];
}): Promise<{ venta?: Venta; error?: string }> {
  const panel = await contextoPanel();
  try {
    const { sede } = sedeActiva(panel, datos.sedeId);
    const venta = await rpc<Venta>("vender", {
      p_sede_id: sede.id, p_items: datos.items, p_pagos: datos.pagos, p_socio_id: datos.socioId, p_turno_id: datos.turnoId,
    });
    revalidatePath("/panel");
    if (datos.socioId) revalidatePath(`/panel/socios/${datos.socioId}`);
    return { venta };
  } catch (e) { return { error: (e as Error).message }; }
}
