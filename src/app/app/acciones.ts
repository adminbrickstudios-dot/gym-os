"use server";
import { notificarDespues } from "@/lib/push";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

const r = async (f: () => Promise<unknown>) => {
  try { await f(); revalidatePath("/app"); revalidatePath("/app/clases"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
};
export const reservarClase = async (claseId: string, socioId: string) => r(() => rpc("reservar", { p_clase_id: claseId, p_socio_id: socioId }));
export const cancelarReserva = async (reservaId: string) => r(() => rpc("cancelar_reserva", { p_reserva_id: reservaId }));
/** El comprobante ya está subido al bucket (desde el navegador, a la carpeta del socio): acá se informa el pago. */
export const informarPago = async (socioId: string, path: string) => r(async () => {
  const x = await rpc<{ pago_id: string }>("informar_transferencia", { p_socio_id: socioId, p_comprobante_path: path, p_cuotas: 1 });
  notificarDespues("comprobante", x?.pago_id);   // PUSH-1: a quien lo revisa
});

/** El QR de entrada (ENT-2): lo arma y lo firma la base; cambia cada 30 segundos. */
export async function codigoQR(gimnasioId: string, socioId: string): Promise<{ codigo?: string; vence_en?: string; error?: string }> {
  try { return await rpc<{ codigo: string; vence_en: string }>("mi_qr", { p_gimnasio_id: gimnasioId, p_socio_id: socioId }); }
  catch (e) { return { error: (e as Error).message }; }
}

/** El socio escaneó el QR de la tablet de la entrada (ENT-6): la base valida el código y anota la entrada. */
export async function escanearEntrada(gimnasioId: string, socioId: string, codigo: string): Promise<{ resultado?: string; color?: string; texto?: string; error?: string }> {
  try {
    const r = await rpc<{ resultado: string; color: string; texto: string }>("entrar_por_qr_pared", { p_gimnasio_id: gimnasioId, p_socio_id: socioId, p_codigo: codigo });
    revalidatePath("/app");
    return r;
  } catch (e) { return { error: (e as Error).message }; }
}

/** Invitar a alguien hoy (INV-1): la recepción confirma cuando llega. */
export async function invitarHoy(gimnasioId: string, socioId: string, nombre: string, dni: string): Promise<{ error?: string }> {
  try { await rpc("invitar", { p_gimnasio_id: gimnasioId, p_socio_id: socioId, p_nombre: nombre, p_dni: dni }); revalidatePath("/app"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
