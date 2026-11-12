"use server";
// VD-1: lo que necesita la ventana de Entrada que vive en todas las pantallas.
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc, rpcLectura } from "@/lib/panel/servidor";
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

/** VD-4: una entrada o un intento que apareció en la puerta (por la recepción, el QR o la tablet). */
export type EntradaViva = {
  ingreso_id: string; momento: string; socio_id: string; socio: string; numero: number; resultado: string; color: string; texto: string;
  via_acceso: string; sede_id: string; cobrar: boolean;
};
export type AlertaViva = { alerta_id: string; momento: string; socio_id: string; socio: string; minutos: number; via_anterior: string; via_nueva: string };
export type LoteEntradas = { hasta: string; avisar: boolean; entradas: EntradaViva[]; alertas: AlertaViva[] };

/**
 * VD-4: lo que pasó en la puerta desde `desde` (null = solo pedir el cursor). La pide cada 4 s la pantalla con la
 * pestaña visible. No pasa por el contexto del panel (sería una consulta más cada 4 s): la base verifica que sea del equipo.
 */
export async function entradasDesde(gimnasioId: string, desde: string | null): Promise<{ lote?: LoteEntradas; error?: string }> {
  try {
    if (!/^[0-9a-f-]{36}$/.test(gimnasioId)) return { error: "Gimnasio inválido" };
    return { lote: await rpcLectura<LoteEntradas>("entradas_desde", { p_gimnasio_id: gimnasioId, p_sede_id: null, p_desde: desde }) };
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-3: cuánto dura una visita y cuándo se avisa de un posible préstamo (por gimnasio). */
export type RegistrarSalida = "no" | "opcional" | "obligatoria";
export type ConfigVisita = { visita_horas: number; antiprestamo_minutos: number; avisar_en_vivo: boolean; registrar_salida: RegistrarSalida };

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

/** BASE-3: la ficha rápida del panel lateral. Todo sale de `ficha_socio` (el veredicto lo calcula la base; acá no se recalcula nada). */
export async function fichaRapida(socioId: string): Promise<{ ficha?: import("@/app/panel/socios/[id]/tipos").Ficha; puedeCobrar?: boolean; datosDePago?: boolean; error?: string }> {
  try {
    const panel = await contextoPanel();
    const ficha = await rpc<import("@/app/panel/socios/[id]/tipos").Ficha>("ficha_socio", { p_socio_id: socioId });
    // FA-1: "cuándo le toca pagar" es una función nueva, apagada por defecto (interruptor del gimnasio).
    const datosDePago = (await rpc<string[]>("funciones_nuevas_gimnasio", { p_gimnasio_id: panel.gimnasio.id })).includes("panel_pago");
    return { ficha, puedeCobrar: panel.yo.rol !== "profe", datosDePago };
  } catch (e) { return { error: (e as Error).message }; }
}
