"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";
import type { Veredicto } from "@/app/panel/entrada/acciones";
import type { Cupon, PreciosVenta } from "./tipos";

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

/** VEN-1: a qué celular y qué texto, armado en la base con el mensaje editable del gimnasio. */
export async function comprobante(ventaId: string): Promise<{ telefono?: string | null; mensaje?: string; error?: string }> {
  try { return await rpc<{ telefono: string | null; mensaje: string }>("comprobante_venta", { p_venta_id: ventaId }); }
  catch (e) { return { error: (e as Error).message }; }
}

/** COM-9: si el código vale hoy (lo dice la base). */
export async function validarCupon(codigo: string): Promise<{ cupon?: Cupon; error?: string }> {
  const panel = await contextoPanel();
  try { return { cupon: await rpc("validar_cupon", { p_gimnasio_id: panel.gimnasio.id, p_codigo: codigo }) }; }
  catch (e) { return { error: (e as Error).message }; }
}

/** Después de cobrar: la venta queda anotada como uso del cupón. */
export async function registrarUsoCupon(ventaId: string, codigo: string): Promise<{ error?: string }> {
  try { await rpc("registrar_uso_cupon", { p_venta_id: ventaId, p_codigo: codigo }); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
