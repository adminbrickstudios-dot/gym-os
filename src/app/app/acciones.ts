"use server";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

const r = async (f: () => Promise<unknown>) => {
  try { await f(); revalidatePath("/app"); revalidatePath("/app/clases"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
};
export const reservarClase = async (claseId: string, socioId: string) => r(() => rpc("reservar", { p_clase_id: claseId, p_socio_id: socioId }));
export const cancelarReserva = async (reservaId: string) => r(() => rpc("cancelar_reserva", { p_reserva_id: reservaId }));
/** El comprobante ya está subido al bucket (desde el navegador, a la carpeta del socio): acá se informa el pago. */
export const informarPago = async (socioId: string, path: string) => r(() => rpc("informar_transferencia", { p_socio_id: socioId, p_comprobante_path: path, p_cuotas: 1 }));

/** El QR de entrada (ENT-2): lo arma y lo firma la base; cambia cada 30 segundos. */
export async function codigoQR(gimnasioId: string, socioId: string): Promise<{ codigo?: string; vence_en?: string; error?: string }> {
  try { return await rpc<{ codigo: string; vence_en: string }>("mi_qr", { p_gimnasio_id: gimnasioId, p_socio_id: socioId }); }
  catch (e) { return { error: (e as Error).message }; }
}
