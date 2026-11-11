"use server";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

/** FA-23: aceptar el lugar que se le ofreció al socio (la base verifica el plazo y que todavía pueda tomar la clase). */
export async function aceptarOferta(reservaId: string): Promise<{ error?: string }> {
  try { await rpc("aceptar_oferta", { p_reserva_id: reservaId }); revalidatePath("/app"); revalidatePath("/app/clases"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** FA-23: dejar pasar el lugar: se le ofrece al que sigue. */
export async function rechazarOferta(reservaId: string): Promise<{ error?: string }> {
  try { await rpc("rechazar_oferta", { p_reserva_id: reservaId }); revalidatePath("/app"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** FA-12: el aviso "tu clase empieza en menos de 1 hora" es del socio: lo prende o lo apaga. */
export async function guardarAvisoClase(socioId: string, si: boolean): Promise<{ error?: string }> {
  try { await rpc("guardar_aviso_clase", { p_socio_id: socioId, p_si: si }); revalidatePath("/app"); revalidatePath("/app/yo"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
