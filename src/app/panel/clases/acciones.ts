"use server";
import { notificarDespues } from "@/lib/push";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

const r = async (fn: () => Promise<unknown>, claseId: string) => {
  try { await fn(); revalidatePath(`/panel/clases/${claseId}`); revalidatePath("/panel/clases"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
};
export const presente = async (claseId: string, socioId: string) => r(() => rpc("tomar_asistencia", { p_clase_id: claseId, p_socio_id: socioId }), claseId);
export const anotar = async (claseId: string, socioId: string) => r(() => rpc("reservar", { p_clase_id: claseId, p_socio_id: socioId }), claseId);
export const cancelarClase = async (claseId: string, motivo: string) =>
  r(async () => { await rpc("cancelar_clase", { p_clase_id: claseId, p_motivo: motivo }); notificarDespues("clase_cancelada", claseId); }, claseId);
/** CLA-7: deshacer un presente marcado por error (con motivo; las reglas de quién y hasta cuándo, en la base). */
export const deshacerPresente = async (claseId: string, socioId: string, motivo: string) =>
  r(() => rpc("anular_presente", { p_clase_id: claseId, p_socio_id: socioId, p_motivo: motivo }), claseId);
/** CLA-4: el WOD de la clase (vacío lo borra). */
export const guardarWod = async (claseId: string, texto: string) => r(() => rpc("guardar_wod", { p_clase_id: claseId, p_texto: texto }), claseId);

/** COM-3: arma un WhatsApp por anotado con el texto (la base lo anota en la clase). */
export type MensajeClase = { socio_id: string; nombre: string; telefono: string | null; mensaje: string };
export async function avisarClase(claseId: string, texto: string): Promise<{ error?: string; mensajes?: MensajeClase[] }> {
  try {
    const r = await rpc<{ mensajes: MensajeClase[] }>("avisar_clase", { p_clase_id: claseId, p_texto: texto });
    revalidatePath(`/panel/clases/${claseId}`);
    return { mensajes: r.mensajes };
  } catch (e) { return { error: (e as Error).message }; }
}
/** COM-12: numerar la sala de esta actividad en esta sede (0 = sin lugares numerados). */
export const guardarLugares = async (claseId: string, cantidad: number, etiqueta: string, fuera: number[]) =>
  r(() => rpc("guardar_lugares", { p_clase_id: claseId, p_cantidad: cantidad, p_etiqueta: etiqueta, p_fuera_servicio: fuera }), claseId);
/** COM-14: crear una TV de la sala (el token se ve una sola vez) y sacarla. */
export async function crearTv(gimnasioId: string, sedeId: string, nombre: string): Promise<{ error?: string; token?: string }> {
  try {
    const r = await rpc<{ id: string; token: string }>("crear_tv", { p_gimnasio_id: gimnasioId, p_sede_id: sedeId, p_nombre: nombre });
    revalidatePath("/panel/clases/tv");
    return { token: r.token };
  } catch (e) { return { error: (e as Error).message }; }
}
export async function revocarTv(id: string): Promise<{ error?: string }> {
  try { await rpc("revocar_tv", { p_id: id }); revalidatePath("/panel/clases/tv"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
