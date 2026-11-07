"use server";
import { revalidatePath } from "next/cache";
import { leerMonto } from "@/lib/formato";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

const r = async (f: () => Promise<unknown>): Promise<{ error?: string }> => {
  try { await f(); revalidatePath("/panel/resultado"); revalidatePath("/panel/gastos"); return {}; } catch (e) { return { error: (e as Error).message }; }
};

/** RES-3 / VD-41: un gasto (de hoy, o del mes que se mira si ya pasó). Quién puede, lo decide la base. */
export async function agregarGasto(fecha: string | null, categoria: string, detalle: string, monto: string) {
  const n = leerMonto(monto);
  if (!(n > 0)) return { error: "Escribí el monto, por ejemplo 250.000" };
  return r(async () => { const p = await contextoPanel(); await rpc("cargar_gasto", { p_gimnasio_id: p.gimnasio.id, p_fecha: fecha, p_categoria: categoria, p_detalle: detalle, p_monto: n }); });
}
export const quitarGasto = async (id: string) => r(() => rpc("anular_gasto", { p_gasto_id: id }));
export const repetirGastos = async (mes: string) => r(async () => { const p = await contextoPanel(); await rpc("repetir_gastos", { p_gimnasio_id: p.gimnasio.id, p_mes: mes }); });
