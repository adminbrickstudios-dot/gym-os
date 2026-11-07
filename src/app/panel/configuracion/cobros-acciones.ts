"use server";
// VD-7 / VD-8 · Configuración → Cobros: cómo vencen las cuotas y cuánto se deja pasar sin pagar.
// Las reglas las valida y las guarda la base (solo el dueño escribe); acá solo se llama y se avisa.
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

export type Renovacion = "continua" | "desde_pago" | "dia_fijo";
export type PrimeraCuotaModo = "proporcional" | "mes_entero" | "gratis" | "completo";
export type ReglasVencimiento = {
  configurado: boolean; renovacion: Renovacion; dia_fijo: number | null; primera_cuota: PrimeraCuotaModo; redondeo: number; tolerancia_dias: number | null;
  ultimo_cambio: { detalle: string; por: string | null; cuando: string } | null;
  planes: { plan_id: string; nombre: string; usa_regla_gimnasio: boolean; renovacion: Renovacion; dia_fijo: number | null; rige_renovacion: Renovacion; rige_dia_fijo: number | null }[];
};
export type Simulacion = { parcial: boolean; precio_lista: number | null; precio: number | null; desde: string; hasta: string; texto: string };

export type ModoDejarPasar = "recepcion_hasta_dias" | "siempre_pin" | "libre";
export type ConfigDejarPasar = {
  configurado: boolean; modo: ModoDejarPasar; dias_max: number; tope_por_dia: number;
  ultimo_cambio: { detalle: string; por: string | null; cuando: string } | null;
};

/** VD-50 (D29) · Aviso de doble cobro: cuántos minutos después de cobrar una cuota otra operación de la misma cuota frena y pregunta (0 = apagado). */
export type ConfigDobleCobro = {
  doble_cobro_minutos: number;
  doble_cobro_ultimo_cambio: { detalle: string; por: string | null; cuando: string } | null;
};

export async function guardarDobleCobro(minutos: number): Promise<{ error?: string; config?: ConfigDobleCobro }> {
  try {
    const panel = await contextoPanel();
    const config = await rpc<ConfigDobleCobro>("guardar_doble_cobro", { p_gimnasio_id: panel.gimnasio.id, p_minutos: minutos });
    revalidatePath("/panel", "layout");
    return { config };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function guardarReglaVencimiento(datos: { renovacion?: Renovacion; dia_fijo?: number | null; primera_cuota?: PrimeraCuotaModo; redondeo?: number }): Promise<{ error?: string; reglas?: ReglasVencimiento }> {
  try {
    const panel = await contextoPanel();
    const reglas = await rpc<ReglasVencimiento>("guardar_regla_vencimiento", { p_gimnasio_id: panel.gimnasio.id, p_datos: datos });
    revalidatePath("/panel", "layout");
    return { reglas };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function guardarReglaPlan(planId: string, usaGimnasio: boolean, renovacion?: Renovacion, diaFijo?: number | null): Promise<{ error?: string; reglas?: ReglasVencimiento }> {
  try {
    const reglas = await rpc<ReglasVencimiento>("guardar_regla_plan", { p_plan_id: planId, p_usa_gimnasio: usaGimnasio, p_renovacion: renovacion ?? null, p_dia_fijo: diaFijo ?? null });
    revalidatePath("/panel", "layout");
    return { reglas };
  } catch (e) { return { error: (e as Error).message }; }
}

/** "¿Y si alguien se anota el …?": el cálculo exacto de la base, sin cobrar nada. */
export async function simularCuota(planId: string, dia: string): Promise<{ error?: string; simulacion?: Simulacion }> {
  try {
    const panel = await contextoPanel();
    return { simulacion: await rpc<Simulacion>("simular_cuota", { p_gimnasio_id: panel.gimnasio.id, p_plan_id: planId, p_dia: dia }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function guardarConfigDejarPasar(modo: ModoDejarPasar, diasMax: number): Promise<{ error?: string; config?: ConfigDejarPasar }> {
  try {
    const panel = await contextoPanel();
    const config = await rpc<ConfigDejarPasar>("guardar_config_dejar_pasar", { p_gimnasio_id: panel.gimnasio.id, p_modo: modo, p_dias_max: diasMax });
    revalidatePath("/panel", "layout");
    return { config };
  } catch (e) { return { error: (e as Error).message }; }
}
