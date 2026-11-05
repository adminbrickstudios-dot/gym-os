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

/** Altas online y reglamento: la base no deja prenderlas sin reglamento. */
export async function guardarAltas(prendidas: boolean, reglamento: string): Promise<{ error?: string; altas?: unknown }> {
  const panel = await contextoPanel();
  try {
    const altas = await rpc("guardar_altas", { p_gimnasio_id: panel.gimnasio.id, p_altas_online: prendidas, p_reglamento: reglamento });
    revalidatePath("/", "layout");
    return { altas };
  } catch (e) { return { error: (e as Error).message }; }
}

/** COM-11: IDs del píxel de Meta y de Google Analytics (la base los valida). */
export async function guardarMedicion(pixel: string, ga: string): Promise<{ error?: string; medicion?: import("./MedicionPagina").MedicionPanel }> {
  const panel = await contextoPanel();
  try {
    const medicion = await rpc<import("./MedicionPagina").MedicionPanel>("guardar_medicion", { p_gimnasio_id: panel.gimnasio.id, p_pixel_meta: pixel, p_google_analytics: ga });
    revalidatePath("/", "layout");
    return { medicion };
  } catch (e) { return { error: (e as Error).message }; }
}
