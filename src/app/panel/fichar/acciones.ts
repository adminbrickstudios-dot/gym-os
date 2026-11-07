"use server";
// VD-53 · Fichar. La base decide todo (si el gimnasio usa fichaje, quién ficha, si ya había una entrada abierta, la hora):
// acá solo se arma el pedido y se devuelve lo que la base contestó, tal cual.
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

export type ResFichaje = { accion?: "entrada" | "salida" | "ya_en_turno" | "sin_entrada"; momento?: string; nombre?: string; minutos?: number; aviso?: string; error?: string; quedan?: number };

const refrescar = () => { revalidatePath("/panel"); revalidatePath("/panel/fichar"); revalidatePath("/panel/horas"); revalidatePath("/panel/profes"); };

/** Fichar como quien opera esta compu (la sesión, o quien puso su PIN en "¿Quién atiende?"). */
export async function ficharAhora(accion: "entrada" | "salida" | null): Promise<ResFichaje> {
  try {
    const p = await contextoPanel();
    const r = await rpc<ResFichaje>("fichar", { p_gimnasio_id: p.gimnasio.id, p_accion: accion });
    refrescar();
    return r;
  } catch (e) { return { error: (e as Error).message }; }
}

/** Fichar con el PIN de la persona, sin cambiar quién atiende en la compu. Sin acción: alterna entrada / salida. */
export async function ficharConPin(pin: string): Promise<ResFichaje> {
  const limpio = pin.trim();
  if (!/^\d{4}$/.test(limpio)) return { error: "El PIN son 4 números" };
  try {
    const p = await contextoPanel();
    const r = await rpc<ResFichaje>("fichar_con_pin", { p_gimnasio_id: p.gimnasio.id, p_pin: limpio, p_accion: null });
    if (r.error) return { error: r.quedan ? `${r.error}: te quedan ${r.quedan} intento${r.quedan === 1 ? "" : "s"}` : r.error };
    refrescar();
    return r;
  } catch (e) { return { error: (e as Error).message }; }
}
