"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

const listo = () => { revalidatePath("/panel/clases/grilla"); revalidatePath("/panel/clases"); return {}; };

export async function guardarActividad(id: string | null, nombre: string, emoji: string): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try { await rpc("guardar_actividad", { p_gimnasio_id: panel.gimnasio.id, p_actividad_id: id, p_nombre: nombre, p_emoji: emoji }); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}

export async function agregarHorario(d: { sede: string; actividad: string; dia: number; hora: string; duracion: number; cupo: number | null; profe: string | null }): Promise<{ error?: string }> {
  try {
    await rpc("agregar_horario", { p_sede_id: d.sede, p_actividad_id: d.actividad, p_dia_semana: d.dia, p_hora_inicio: d.hora,
      p_duracion_min: d.duracion, p_cupo: d.cupo, p_profe_id: d.profe });
    return listo();
  } catch (e) { return { error: (e as Error).message }; }
}

export async function cerrarHorario(id: string): Promise<{ error?: string }> {
  try { await rpc("cerrar_horario", { p_horario_id: id }); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}
