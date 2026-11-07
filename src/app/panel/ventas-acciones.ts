"use server";
import { notificarDespues } from "@/lib/push";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

export type Venta = {
  venta_id: string; fecha: string; estado: "pendiente" | "confirmada" | "anulada"; sede_id: string; socio_id: string | null; socio: string | null;
  total: number; detalle: string | null; medios: string[]; cobro: string | null; anulada_motivo: string | null; anulada_por: string | null;
  pedido: { pedido_id: string; motivo: string; por: string; en: string } | null;
  /** VD-56: el número de su recibo, si se cobró alguna vez. */
  recibo_n?: number | null;
};

const refrescar = (socioId?: string | null) => { revalidatePath("/panel"); if (socioId) revalidatePath(`/panel/socios/${socioId}`); };

/** Dueño y encargado (VEN-6). La base decide quién puede. */
export async function anularVenta(ventaId: string, motivo: string, socioId?: string | null): Promise<{ error?: string }> {
  try { await rpc("anular_venta_panel", { p_venta_id: ventaId, p_motivo: motivo }); refrescar(socioId); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** La recepción la pide (ventas suyas de hoy). */
export async function pedirAnulacion(ventaId: string, motivo: string): Promise<{ error?: string }> {
  try { notificarDespues("pedido_anulacion", await rpc<string>("pedir_anulacion", { p_venta_id: ventaId, p_motivo: motivo })); refrescar(); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

export async function resolverAnulacion(pedidoId: string, aprobar: boolean, socioId?: string | null): Promise<{ error?: string }> {
  try { await rpc("resolver_pedido_anulacion", { p_pedido_id: pedidoId, p_aprobar: aprobar }); refrescar(socioId); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
