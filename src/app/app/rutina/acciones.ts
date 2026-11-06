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
