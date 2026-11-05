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
