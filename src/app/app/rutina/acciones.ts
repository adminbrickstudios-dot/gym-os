"use server";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

/** VD-20: "Hice el Día N". La base cuenta un hecho por día calendario del gimnasio: tocarlo dos veces no duplica. */
export async function marcarDiaHecho(socioId: string, dia: number, deshacer = false): Promise<{ error?: string }> {
  try {
    await rpc(deshacer ? "desmarcar_dia_rutina" : "marcar_dia_rutina", { p_socio_id: socioId, p_dia: dia });
    revalidatePath("/app/rutina");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** FA-15: marcar (o desmarcar) una serie hecha hoy. La base cuenta un hecho por serie y día; no pasa de las series de la rutina. */
export async function marcarSerie(socioId: string, dia: number, ejercicioId: string, serie: number, hecha: boolean): Promise<{ error?: string }> {
  try {
    await rpc("marcar_serie_rutina", { p_socio_id: socioId, p_dia: dia, p_ejercicio_id: ejercicioId, p_serie: serie, p_hecha: hecha });
    revalidatePath("/app/rutina");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
