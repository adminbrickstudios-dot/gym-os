"use server";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

const r = async (fn: () => Promise<unknown>) => {
  try { await fn(); revalidatePath("/panel/grados"); revalidatePath("/panel/socios", "layout"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
};
export const guardarGrado = async (actividadId: string, gradoId: string | null, nombre: string, orden: number, clases: number, meses: number, color: string | null) =>
  r(() => rpc("guardar_grado", { p_actividad_id: actividadId, p_grado_id: gradoId, p_nombre: nombre, p_orden: orden, p_clases_minimas: clases, p_meses_minimos: meses, p_color: color }));
export const archivarGrado = async (gradoId: string) => r(() => rpc("archivar_grado", { p_grado_id: gradoId }));
export const otorgarGrado = async (socioId: string, gradoId: string, fecha: string | null) =>
  r(() => rpc("otorgar_grado", { p_socio_id: socioId, p_grado_id: gradoId, p_fecha: fecha || null }));
export const anularGradoSocio = async (id: string, motivo: string) => r(() => rpc("anular_grado_socio", { p_id: id, p_motivo: motivo }));
