"use server";
import { gimnasioActual } from "@/lib/supabase/servidor";
// VD-1: lo que necesita la ventana de Entrada que vive en todas las pantallas.
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc, rpcLectura } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";
import type { ConfigEntrada } from "./config";

export type UltimaEntrada = { ingreso_id: string; momento: string; socio_id: string; socio: string; numero: number; resultado: string; color: string; via_acceso: string };

/** Las últimas entradas del día en esta sede (la barra fija). Las lee la base, no se calculan acá. */
export async function ultimasEntradas(sedeId: string): Promise<{ entradas?: UltimaEntrada[]; error?: string }> {
  try {
    // E8: la sede viene de la propia pantalla (la eligió el servidor al pintarla) y la base verifica que sea de este gimnasio: sin pedir el contexto de nuevo.
    const g = await gimnasioActual();
    const todas = await rpc<UltimaEntrada[]>("ingresos_del_dia", { p_gimnasio_id: g.id, p_sede_id: sedeId });
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
    const g = await gimnasioActual();   // E8: sin el contexto del panel (un viaje menos); la base decide el permiso igual
    return { config: await rpc<ConfigVisita>("config_visita", { p_gimnasio_id: g.id }) };
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
export type NumerosSocio = { ultima_vez: string | null; veces_mes: number; promedio_gimnasio_mes: number; semanas_seguidas: number; mejor_racha: number; cuando_viene: { dia: number; veces: number }[]; hora_habitual: number | null };
export async function fichaRapida(socioId: string): Promise<{ ficha?: import("@/app/panel/socios/[id]/tipos").Ficha; puedeCobrar?: boolean; datosDePago?: boolean; notas?: string[]; etiquetas?: string[]; numeros?: NumerosSocio | null; error?: string }> {
  try {
    const panel = await contextoPanel();
    const ficha = await rpc<import("@/app/panel/socios/[id]/tipos").Ficha>("ficha_socio", { p_socio_id: socioId });
    // FA-1: "cuándo le toca pagar" es una función nueva, apagada por defecto (interruptor del gimnasio).
    const activas = await rpc<string[]>("funciones_nuevas_activas", { p_gimnasio_id: panel.gimnasio.id });
    const datosDePago = activas.includes("panel_pago");
    // Pase 2.0 · organización: con la llave, los tres números de ver sin entrar (este mes, última vez, semanas seguidas). Si fallan, no se muestran.
    const numeros = activas.includes("pase_2_organizacion") && panel.yo.rol !== "profe"
      ? await rpc<NumerosSocio>("numeros_socio", { p_gimnasio_id: panel.gimnasio.id, p_socio_id: socioId }).catch(() => null) : null;
    // Detalle 20: con la función prendida, el panel también muestra las notas y etiquetas del socio (la profe no las ve: la base no se las da).
    let notas: string[] | undefined, etiquetas: string[] | undefined;
    if (datosDePago && panel.yo.rol !== "profe") {
      const ne = await rpc<{ notas: { texto: string }[]; etiquetas: { nombre: string }[] }>("notas_y_etiquetas", { p_socio_id: socioId }).catch(() => null);
      notas = ne?.notas.slice(0, 3).map((n) => n.texto); etiquetas = ne?.etiquetas.map((x) => x.nombre);
    }
    return { ficha, puedeCobrar: panel.yo.rol !== "profe", datosDePago, notas, etiquetas, numeros };
  } catch (e) { return { error: (e as Error).message }; }
}

/** D83: "Dar el alta y cobrar" a un socio con cuenta y sin plan: se le asigna el plan elegido (queda sin cobertura hasta que se cobre). La base valida el permiso y el plan. */
export async function asignarPlanSocio(socioId: string, planId: string): Promise<{ error?: string }> {
  try {
    await rpc("asignar_plan", { p_socio_id: socioId, p_plan_id: planId });
    revalidatePath(`/panel/socios/${socioId}`);
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
