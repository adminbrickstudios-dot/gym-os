"use server";
// VD-52 · Acciones de la liquidación de profes. La base decide (quién puede, cuánto falta, de qué caja sale);
// acá solo se arman los pedidos y se devuelve el mensaje de la base tal cual.
import { revalidatePath } from "next/cache";
import { leerMonto } from "@/lib/formato";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

type Resp = { error?: string };
const hacer = async (f: () => Promise<unknown>): Promise<Resp> => {
  try { await f(); revalidatePath("/panel/profes"); revalidatePath("/panel/cuenta"); revalidatePath("/panel/caja"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
};
const MAL = "No entiendo el monto: escribilo como 8.000 o 8000,50";

export type Detalle = {
  mes: string;
  clases: { clase_id: string; dia: string; actividad: string; minutos: number; presentes: number; modo: string | null; importe: number }[];
  horas: { id: string; fecha: string; minutos: number; nota: string | null }[];
  pagos: { id: string; monto: number; medio: string; nota: string | null; pagado_en: string; pagado_por: string; anulado_en: string | null; anulado_motivo: string | null }[];
};

export async function verDetalle(profeId: string, mes: string): Promise<{ detalle?: Detalle; error?: string }> {
  try {
    const p = await contextoPanel();
    return { detalle: await rpc<Detalle>("liquidacion_profe_detalle", { p_gimnasio_id: p.gimnasio.id, p_profe_id: profeId, p_mes: mes }, { lectura: true }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function guardarRegla(profeId: string, modo: string, monto: string, desde: string): Promise<Resp> {
  const m = leerMonto(monto);
  if (Number.isNaN(m) || m < 0) return { error: MAL };
  return hacer(async () => {
    const p = await contextoPanel();
    await rpc("guardar_regla_profe", { p_gimnasio_id: p.gimnasio.id, p_profe_id: profeId, p_modo: modo, p_monto: m, p_vigente_desde: desde || null });
  });
}

export async function cargarHoras(profeId: string, fecha: string, horas: string, nota: string): Promise<Resp> {
  // "2", "2,5" o "2:30" → minutos.
  const t = horas.trim().replace(",", ".");
  const minutos = /^\d+:\d{2}$/.test(t) ? Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]) : Math.round(Number(t) * 60);
  if (!Number.isFinite(minutos) || minutos < 1) return { error: "Escribí las horas, por ejemplo 2, 2,5 o 2:30" };
  return hacer(async () => {
    const p = await contextoPanel();
    await rpc("cargar_horas_profe", { p_gimnasio_id: p.gimnasio.id, p_profe_id: profeId, p_fecha: fecha, p_minutos: minutos, p_nota: nota || null });
  });
}

export const anularHoras = async (id: string, motivo: string): Promise<Resp> => hacer(() => rpc("anular_horas_profe", { p_horas_id: id, p_motivo: motivo }));

export async function pagarProfe(d: { profeId: string; mes: string; monto: string; medio: string; nota: string; turnoId: string | null; clave: string }): Promise<Resp> {
  const m = leerMonto(d.monto);
  if (Number.isNaN(m) || !(m > 0)) return { error: MAL };
  return hacer(async () => {
    const p = await contextoPanel();
    await rpc("pagar_profe", { p_gimnasio_id: p.gimnasio.id, p_profe_id: d.profeId, p_mes: d.mes, p_monto: m, p_medio: d.medio,
      p_nota: d.nota || null, p_turno_id: d.medio === "efectivo" ? d.turnoId : null, p_clave: d.clave });
  });
}

export const anularPago = async (id: string, motivo: string, turnoId: string | null): Promise<Resp> =>
  hacer(() => rpc("anular_pago_profe", { p_pago_id: id, p_motivo: motivo, p_turno_id: turnoId }));

export const guardarConfigLiquidacion = async (encargadoVe: boolean): Promise<Resp> =>
  hacer(async () => { const p = await contextoPanel(); await rpc("guardar_config_liquidacion", { p_gimnasio_id: p.gimnasio.id, p_encargado_ve: encargadoVe }); });
