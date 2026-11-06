"use server";
// VD-46: suspender o expulsar, cortesías con tope y devolución al dar de baja. La base decide quién puede y cuánto;
// acá solo se llama y se refresca la ficha. Cada función devuelve el mensaje de la base si no se pudo.
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

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

// ── VD-46C · Cortesías y motivos ───────────────────────────────────
export async function darCortesia(socioId: string, dias: number, motivoId: string, nota: string): Promise<R> {
  return hacer(socioId, () => rpc("dar_cortesia", { p_socio_id: socioId, p_dias: dias, p_motivo_id: motivoId, p_nota: nota || null }));
}
export async function anularCortesia(socioId: string, coberturaId: string, motivo: string): Promise<R> {
  return hacer(socioId, () => rpc("anular_cortesia", { p_cobertura_id: coberturaId, p_motivo: motivo }));
}
/** La lista de motivos del gimnasio (para el motivo del descuento de Cobrar y Vender). */
export async function motivosBeneficio(): Promise<{ motivos?: { id: string; nombre: string }[]; error?: string }> {
  try {
    const panel = await contextoPanel();
    return { motivos: await rpc<{ id: string; nombre: string }[]>("motivos_beneficio_gimnasio", { p_gimnasio_id: panel.gimnasio.id }, { lectura: true }) };
  } catch (e) { return { error: (e as Error).message }; }
}
export async function guardarMotivoBeneficio(gimnasioId: string, id: string | null, nombre: string, activo: boolean): Promise<R> {
  try { await rpc("guardar_motivo_beneficio", { p_gimnasio_id: gimnasioId, p_id: id, p_nombre: nombre, p_activo: activo }); revalidatePath("/panel/control"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
export async function guardarTopesBeneficios(gimnasioId: string, t: { recepcionDias: number; encargadoDias: number; recepcionMes: number; encargadoMes: number; alerta: number }): Promise<R> {
  try {
    await rpc("guardar_topes_beneficios", { p_gimnasio_id: gimnasioId, p_max_dias_recepcion: t.recepcionDias, p_max_dias_encargado: t.encargadoDias,
      p_dias_mes_recepcion: t.recepcionMes, p_dias_mes_encargado: t.encargadoMes, p_alerta_repetidas: t.alerta });
    revalidatePath("/panel/control");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
