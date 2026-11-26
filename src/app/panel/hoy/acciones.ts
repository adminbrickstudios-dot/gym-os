"use server";
// Pase 2.0 · organización (26/11): tildar a mano lo que no tiene un hecho propio ("ya lo llamé", un interesado escrito) y deshacer el último.
// La base exige la llave y el rol, y no deja tildar a mano lo que sale de un hecho (cobro, aviso, respuesta, tarea). Deshacer = anular.
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

export async function tildarHecho(referencia: string, texto: string): Promise<{ error?: string }> {
  try {
    const panel = await contextoPanel();
    await rpc<string>("tildar_hecho", { p_gimnasio_id: panel.gimnasio.id, p_referencia: referencia, p_texto: texto });
    revalidatePath("/panel/bloque/hoy");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function deshacerUltimoHecho(): Promise<{ error?: string }> {
  try {
    const panel = await contextoPanel();
    await rpc<string>("deshacer_ultimo_hecho", { p_gimnasio_id: panel.gimnasio.id });
    revalidatePath("/panel/bloque/hoy");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
