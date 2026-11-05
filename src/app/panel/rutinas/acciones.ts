"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

const listo = () => { revalidatePath("/panel/rutinas"); return {}; };

/** RUT-1: un ejercicio de la biblioteca (nuevo o editado). */
export async function guardarEjercicio(id: string | null, nombre: string, grupo: string, video: string, activo = true): Promise<{ error?: string; id?: string }> {
  const panel = await contextoPanel();
  try {
    const nuevo = await rpc<string>("guardar_ejercicio", { p_gimnasio_id: panel.gimnasio.id, p_id: id, p_nombre: nombre, p_grupo: grupo, p_video: video || null, p_activo: activo });
    revalidatePath("/panel/rutinas");
    return { id: nuevo };
  } catch (e) { return { error: (e as Error).message }; }
}

export type ItemRutina = { dia: number; ejercicio_id: string; series: number; repeticiones: string; nota?: string | null };

/** RUT-1: guarda la rutina con sus días y ejercicios (reemplaza los anteriores). */
export async function guardarRutina(id: string | null, nombre: string, descripcion: string, items: ItemRutina[]): Promise<{ error?: string; id?: string }> {
  const panel = await contextoPanel();
  try {
    const rid = await rpc<string>("guardar_rutina", { p_gimnasio_id: panel.gimnasio.id, p_id: id, p_nombre: nombre, p_descripcion: descripcion || null, p_items: items });
    revalidatePath("/panel/rutinas");
    return { id: rid };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function archivarRutina(id: string): Promise<{ error?: string }> {
  try { await rpc("archivar_rutina", { p_rutina_id: id }); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}

/** RUT-2: asignar la rutina a un socio (reemplaza la que tenía). */
export async function asignarRutina(socioId: string, rutinaId: string): Promise<{ error?: string }> {
  try { await rpc("asignar_rutina", { p_socio_id: socioId, p_rutina_id: rutinaId }); return listo(); }
  catch (e) { return { error: (e as Error).message }; }
}
