"use server";
import { notificarDespues } from "@/lib/push";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { clienteServicio } from "@/lib/supabase/servicio";
import { reconsultarMercadoPago } from "@/lib/mp-reconsulta";

type Pendiente = { pago_id: string; comprobante_path: string | null };

/**
 * Link de 10 minutos al comprobante. Antes de firmar con la clave de servicio,
 * se confirma que el pago está en la lista que esta persona puede aprobar.
 */
export async function verComprobante(pagoId: string): Promise<{ url?: string; error?: string }> {
  const panel = await contextoPanel();
  try {
    const pendientes = await rpc<Pendiente[]>("pagos_por_aprobar", { p_gimnasio_id: panel.gimnasio.id });
    const p = pendientes.find((x) => x.pago_id === pagoId);
    if (!p?.comprobante_path) return { error: "Ese comprobante no está entre los tuyos para aprobar" };
    const { data, error } = await clienteServicio().storage.from("comprobantes").createSignedUrl(p.comprobante_path, 600);
    if (error) return { error: `No se pudo abrir el comprobante: ${error.message}` };
    return { url: data.signedUrl };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function aprobar(pagoId: string): Promise<{ error?: string }> {
  try { await rpc("aprobar_pago", { p_pago_id: pagoId }); notificarDespues("pago_resuelto", pagoId); revalidatePath("/panel/transferencias"); revalidatePath("/panel"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

export async function rechazar(pagoId: string, motivo: string): Promise<{ error?: string }> {
  try { await rpc("rechazar_pago", { p_pago_id: pagoId, p_motivo: motivo }); notificarDespues("pago_resuelto", pagoId); revalidatePath("/panel/transferencias"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

export type ResultadoRevision = { error?: string; sinMercadoPago?: boolean; revisados?: number; cambios?: number; sinPago?: number; fallaron?: number };

/**
 * VD-46A: "Revisar con MercadoPago" (dueño y encargado). Sin cron: reconsulta a MercadoPago los pagos pendientes de
 * más de 15 minutos y los aprobados del último mes, y aplica lo que encuentre (acredita lo que quedó colgado, retira
 * lo devuelto o contracargado). La persona se comprueba con su sesión (estado_pagos_online exige dueño o encargado);
 * revertir lo hace después el servidor con la clave de servicio, nunca el navegador.
 */
export async function revisarConMercadoPago(): Promise<ResultadoRevision> {
  try {
    const panel = await contextoPanel();
    const estado = await rpc<{ conectado: boolean }>("estado_pagos_online", { p_gimnasio_id: panel.gimnasio.id });
    if (!estado.conectado) return { sinMercadoPago: true };
    const r = await reconsultarMercadoPago(panel.gimnasio.id);
    if (!r) return { sinMercadoPago: true };
    revalidatePath("/panel/transferencias"); revalidatePath("/panel"); revalidatePath("/panel/campana");
    return { revisados: r.revisados, cambios: r.cambios.length, sinPago: r.sinPago, fallaron: r.errores.length };
  } catch (e) { return { error: (e as Error).message }; }
}
