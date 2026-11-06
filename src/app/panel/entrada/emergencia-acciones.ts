"use server";
// VD-46M · Modo emergencia de la puerta: todo lo decide la base (emergencias_puerta); acá solo se llama.
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";
import type { EntradaEmergencia, EstadoEmergencia } from "./emergencia-tipos";

/** Lo que dice la base de la emergencia de esta sede (la leen el cartel rojo y el panel de la Entrada). */
export async function estadoEmergencia(sedeId: string): Promise<{ e?: EstadoEmergencia; error?: string }> {
  try {
    const panel = await contextoPanel();
    const { sede } = sedeActiva(panel, sedeId);
    return { e: await rpc<EstadoEmergencia>("estado_emergencia_puerta", { p_gimnasio_id: panel.gimnasio.id, p_sede_id: sede.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

/** Solo el dueño la prende o la apaga para el gimnasio (arranca apagada). */
export async function habilitarEmergencia(habilitada: boolean): Promise<{ error?: string }> {
  try {
    const panel = await contextoPanel();
    await rpc("habilitar_emergencia_puerta", { p_gimnasio_id: panel.gimnasio.id, p_habilitada: habilitada });
    revalidatePath("/panel/entrada");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function activarEmergencia(sedeId: string, motivo: string, horas: number): Promise<{ e?: EstadoEmergencia; error?: string }> {
  try {
    const panel = await contextoPanel();
    const { sede } = sedeActiva(panel, sedeId);
    const e = await rpc<EstadoEmergencia>("activar_emergencia_puerta", { p_gimnasio_id: panel.gimnasio.id, p_sede_id: sede.id, p_motivo: motivo, p_horas: horas });
    revalidatePath("/panel/entrada");
    return { e };
  } catch (e) { return { error: (e as Error).message }; }
}

/** Al cerrarla vuelve la lista de quiénes entraron en ese rato. */
export async function cerrarEmergencia(id: string): Promise<{ entradas?: EntradaEmergencia[]; error?: string }> {
  try {
    const panel = await contextoPanel();
    const r = await rpc<{ entradas: EntradaEmergencia[] }>("cerrar_emergencia_puerta", { p_gimnasio_id: panel.gimnasio.id, p_emergencia_id: id });
    revalidatePath("/panel/entrada");
    return { entradas: r.entradas };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function entradasDeEmergencia(id: string): Promise<{ entradas?: EntradaEmergencia[]; error?: string }> {
  try {
    const panel = await contextoPanel();
    return { entradas: await rpc<EntradaEmergencia[]>("entradas_de_emergencia", { p_gimnasio_id: panel.gimnasio.id, p_emergencia_id: id }) };
  } catch (e) { return { error: (e as Error).message }; }
}
