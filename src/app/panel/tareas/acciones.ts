"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

const refrescar = () => { revalidatePath("/panel/tareas"); revalidatePath("/panel"); };

/** COM-4: la base valida quién puede (cada uno las suyas; dueño y encargado todas). VD-13: puede repetirse. */
export async function crearTarea(que: string, para: string, dia: string, socioId: string | null, repite: string | null = null): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("crear_tarea", { p_gimnasio_id: panel.gimnasio.id, p_que: que, p_para: para, p_dia: dia, p_socio_id: socioId, p_repite: repite || null });
    refrescar();
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function marcarTarea(id: string, hecha: boolean): Promise<{ error?: string }> {
  try {
    await rpc("marcar_tarea", { p_tarea_id: id, p_hecha: hecha });
    refrescar();
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-13: el checklist de apertura y cierre se tilda por día. */
export async function tildarChecklist(id: string, hecha: boolean): Promise<{ error?: string }> {
  try {
    await rpc("tildar_checklist", { p_item_id: id, p_hecha: hecha });
    refrescar();
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function guardarItemChecklist(momento: "apertura" | "cierre", texto: string, id: string | null = null, activo = true): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_checklist_item", { p_gimnasio_id: panel.gimnasio.id, p_momento: momento, p_texto: texto, p_id: id, p_activo: activo });
    refrescar();
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-13: prender/apagar una automática, darle una persona o un rol, y su cantidad de días. */
export async function guardarTareaAuto(clave: string, activa: boolean, paraRol: string | null, paraEquipo: string | null, dias: number | null): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_tarea_auto", { p_gimnasio_id: panel.gimnasio.id, p_clave: clave, p_activa: activa, p_para_rol: paraRol, p_para_equipo: paraEquipo, p_dias: dias });
    refrescar();
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
