"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

/** COM-4: la base valida quién puede (cada uno las suyas; dueño y encargado todas). */
export async function crearTarea(que: string, para: string, dia: string, socioId: string | null): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("crear_tarea", { p_gimnasio_id: panel.gimnasio.id, p_que: que, p_para: para, p_dia: dia, p_socio_id: socioId });
    revalidatePath("/panel/tareas"); revalidatePath("/panel");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function marcarTarea(id: string, hecha: boolean): Promise<{ error?: string }> {
  try {
    await rpc("marcar_tarea", { p_tarea_id: id, p_hecha: hecha });
    revalidatePath("/panel/tareas"); revalidatePath("/panel");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
