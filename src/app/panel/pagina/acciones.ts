"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

/** Guarda portada y secciones juntas; devuelve la página tal como quedó en la base. */
export async function guardarPagina(portada: unknown, secciones: unknown): Promise<{ error?: string; pagina?: unknown }> {
  const panel = await contextoPanel();
  try {
    const pagina = await rpc("guardar_pagina", { p_gimnasio_id: panel.gimnasio.id, p_portada: portada, p_secciones: secciones });
    revalidatePath("/", "layout");
    return { pagina };
  } catch (e) { return { error: (e as Error).message }; }
}
