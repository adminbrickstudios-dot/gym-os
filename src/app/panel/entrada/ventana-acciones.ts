"use server";
// VD-1: lo que necesita la ventana de Entrada que vive en todas las pantallas.
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";
import type { ConfigEntrada } from "./config";

export type UltimaEntrada = { ingreso_id: string; momento: string; socio_id: string; socio: string; numero: number; resultado: string; color: string; via_acceso: string };

/** Las últimas entradas del día en esta sede (la barra fija). Las lee la base, no se calculan acá. */
export async function ultimasEntradas(sedeId: string): Promise<{ entradas?: UltimaEntrada[]; error?: string }> {
  try {
    const panel = await contextoPanel();
    const { sede } = sedeActiva(panel, sedeId);
    const todas = await rpc<UltimaEntrada[]>("ingresos_del_dia", { p_gimnasio_id: panel.gimnasio.id, p_sede_id: sede.id });
    return { entradas: todas.filter((i) => i.resultado !== "rechazado").slice(0, 5) };
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-3: cuánto dura una visita y cuándo se avisa de un posible préstamo (por gimnasio). */
export type ConfigVisita = { visita_horas: number; antiprestamo_minutos: number };

export async function leerConfigVisita(): Promise<{ config?: ConfigVisita; error?: string }> {
  try {
    const panel = await contextoPanel();
    return { config: await rpc<ConfigVisita>("config_visita", { p_gimnasio_id: panel.gimnasio.id }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function guardarConfigVisita(datos: Partial<ConfigVisita>): Promise<{ config?: ConfigVisita; error?: string }> {
  try {
    const panel = await contextoPanel();
    return { config: await rpc<ConfigVisita>("guardar_config_visita", { p_gimnasio_id: panel.gimnasio.id, p_datos: datos }) };
  } catch (e) { return { error: (e as Error).message }; }
}

/** Configuración → Entrada (por gimnasio). La base valida cada campo y quién puede cambiarlo. */
export async function guardarConfigEntrada(datos: Partial<ConfigEntrada>): Promise<{ error?: string; config?: ConfigEntrada }> {
  try {
    const panel = await contextoPanel();
    const config = await rpc<ConfigEntrada>("guardar_config_entrada", { p_gimnasio_id: panel.gimnasio.id, p_datos: datos });
    revalidatePath("/panel", "layout");
    return { config };
  } catch (e) { return { error: (e as Error).message }; }
}
