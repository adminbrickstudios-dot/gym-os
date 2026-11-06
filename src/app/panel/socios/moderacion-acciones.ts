"use server";
// VD-46: suspender o expulsar, cortesías con tope y devolución al dar de baja. La base decide quién puede y cuánto;
// acá solo se llama y se refresca la ficha. Cada función devuelve el mensaje de la base si no se pudo.
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

type R = { error?: string };
async function hacer(socioId: string, fn: () => Promise<unknown>): Promise<R> {
  try { await fn(); revalidatePath(`/panel/socios/${socioId}`); revalidatePath("/panel"); revalidatePath("/panel/control"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

export async function suspenderSocio(socioId: string, motivo: string, tipo: "suspension" | "expulsion", hasta: string, revisar: string): Promise<R> {
  return hacer(socioId, () => rpc("suspender_socio", { p_socio_id: socioId, p_motivo: motivo, p_tipo: tipo, p_hasta: hasta || null, p_revisar_el: revisar || null }));
}
export async function levantarSuspension(socioId: string, suspensionId: string, motivo: string): Promise<R> {
  return hacer(socioId, () => rpc("levantar_suspension", { p_suspension_id: suspensionId, p_motivo: motivo }));
}
export async function revisarSuspension(socioId: string, suspensionId: string, revisar: string): Promise<R> {
  return hacer(socioId, () => rpc("revisar_suspension", { p_suspension_id: suspensionId, p_revisar_el: revisar }));
}
