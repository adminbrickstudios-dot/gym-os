"use server";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

export type MiLugar = { estado: "anotado" | "espera"; posicion?: number; precio: number; pago: boolean };

/** VD-19: el socio se anota desde la app. La base bloquea el evento, no repite y decide si queda anotado o en espera. */
export async function anotarmeEvento(socioId: string, eventoId: string): Promise<{ lugar?: MiLugar; error?: string }> {
  try {
    const lugar = await rpc<MiLugar>("inscribirse_evento", { p_socio_id: socioId, p_evento_id: eventoId });
    revalidatePath("/app");
    return { lugar };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function bajarmeDeEvento(socioId: string, eventoId: string): Promise<{ error?: string }> {
  try { await rpc("cancelar_inscripcion_evento", { p_socio_id: socioId, p_evento_id: eventoId }); revalidatePath("/app"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
