"use server";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

type Resp = { error?: string };

/** El socio reserva con su pack: la base elige de cuál se descuenta y no deja reservar sin sesiones vigentes. */
export async function reservarMiSesion(socioId: string, franjaId: string): Promise<Resp> {
  try { await rpc("reservar_sesion_pt", { p_socio_id: socioId, p_franja_id: franjaId }); revalidatePath("/app/pt"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** Con la antelación del gimnasio se devuelve la sesión; si ya pasó el plazo, la base lo dice. */
export async function cancelarMiSesion(sesionId: string): Promise<Resp> {
  try { await rpc("cancelar_sesion_pt", { p_sesion_id: sesionId, p_motivo: null }); revalidatePath("/app/pt"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
