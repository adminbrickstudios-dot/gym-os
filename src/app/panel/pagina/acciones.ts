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

/** VD-25: "+N socios" y reseñas de la portada (la base valida el puntaje y la cantidad). */
export async function guardarPruebaSocial(socios: boolean, puntaje: string, cantidad: string): Promise<{ error?: string; prueba?: import("./PruebaSocial").PruebaSocialPanel }> {
  const panel = await contextoPanel();
  const num = (t: string) => (t.trim() === "" ? null : Number(t.trim().replace(",", ".")));
  const pt = num(puntaje), cn = num(cantidad);
  if ((pt !== null && !Number.isFinite(pt)) || (cn !== null && (!Number.isInteger(cn)))) return { error: "Reseñas: el puntaje es un número (ej: 4,8) y la cantidad un número entero" };
  try {
    const prueba = await rpc<import("./PruebaSocial").PruebaSocialPanel>("guardar_prueba_social", { p_gimnasio_id: panel.gimnasio.id, p_mostrar_socios: socios, p_puntaje: pt, p_cantidad: cn });
    revalidatePath("/", "layout");
    return { prueba };
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
