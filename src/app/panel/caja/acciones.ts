"use server";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

export type Resumen = {
  turno_id: string; abierto_en: string; cerrado_en: string | null; monto_inicial: number; efectivo: number;
  ingresos: number; retiros: number; esperado: number; contado: number | null; diferencia: number | null;
  otros_medios: Record<string, number>;
};
const num = (s: string) => Number(String(s).replace(/\./g, "").replace(",", "."));

export async function abrirCaja(cajaId: string, monto: string): Promise<{ error?: string }> {
  if (!(num(monto) >= 0)) return { error: "Escribí con cuánto abrís (0 si está vacía)" };
  try { await rpc("abrir_caja", { p_caja_id: cajaId, p_monto_inicial: num(monto) }); revalidatePath("/panel/caja"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

export async function moverCaja(turnoId: string, tipo: "ingreso" | "retiro", monto: string, motivo: string): Promise<{ error?: string }> {
  try { await rpc("movimiento_caja", { p_turno_id: turnoId, p_tipo: tipo, p_monto: num(monto), p_motivo: motivo }); revalidatePath("/panel/caja"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** Arqueo ciego: se informa lo contado y recién ahí se ve lo esperado. */
export async function cerrarCaja(turnoId: string, contado: string, nota: string): Promise<{ resumen?: Resumen; error?: string }> {
  if (!(num(contado) >= 0)) return { error: "Escribí cuánta plata contaste" };
  try {
    // Sin revalidar: si la página se vuelve a pintar, el turno ya cerrado desaparece
    // antes de que se vea el resultado del arqueo. La pantalla refresca al tocar "Listo".
    const resumen = await rpc<Resumen>("cerrar_caja", { p_turno_id: turnoId, p_monto_contado: num(contado), p_nota: nota || null });
    return { resumen };
  } catch (e) { return { error: (e as Error).message }; }
}
