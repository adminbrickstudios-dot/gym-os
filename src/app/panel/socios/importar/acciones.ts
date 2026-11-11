"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

export async function revisar(filas: unknown[]): Promise<{ error?: string; revision?: unknown }> {
  const panel = await contextoPanel();
  try { return { revision: await rpc("revisar_importacion", { p_gimnasio_id: panel.gimnasio.id, p_filas: filas }) }; }
  catch (e) { return { error: (e as Error).message }; }
}

export async function importar(filas: unknown[], archivo: string): Promise<{ error?: string; resultado?: { importacion_id: string; importados: number; salteados: number; ya_existian?: number; repetidas_en_archivo?: number; con_cobertura?: number; pagos_cargados?: number; monto_pagos?: number | string } }> {
  const panel = await contextoPanel();
  try {
    const resultado = await rpc<NonNullable<Awaited<ReturnType<typeof importar>>["resultado"]>>("importar_socios", { p_gimnasio_id: panel.gimnasio.id, p_filas: filas, p_archivo: archivo });
    revalidatePath("/panel/socios", "layout");
    return { resultado };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function deshacer(id: string): Promise<{ error?: string; borrados?: number }> {
  const panel = await contextoPanel();
  try {
    const borrados = await rpc<number>("deshacer_importacion", { p_gimnasio_id: panel.gimnasio.id, p_importacion_id: id });
    revalidatePath("/panel/socios", "layout");
    return { borrados };
  } catch (e) { return { error: (e as Error).message }; }
}
