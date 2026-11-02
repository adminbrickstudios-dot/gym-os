"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { clienteServicio } from "@/lib/supabase/servicio";

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
  try { await rpc("aprobar_pago", { p_pago_id: pagoId }); revalidatePath("/panel/transferencias"); revalidatePath("/panel"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

export async function rechazar(pagoId: string, motivo: string): Promise<{ error?: string }> {
  try { await rpc("rechazar_pago", { p_pago_id: pagoId, p_motivo: motivo }); revalidatePath("/panel/transferencias"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
