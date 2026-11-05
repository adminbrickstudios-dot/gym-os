"use server";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

/** AVI-1: avisado ✓ (queda anotado quién y cuándo; ese aviso no vuelve otro día). */
export async function marcarAvisado(socioId: string, clave: string, referencia: string): Promise<{ error?: string }> {
  try { await rpc("marcar_avisado", { p_socio_id: socioId, p_clave: clave, p_referencia: referencia }); revalidatePath("/panel/avisos"); revalidatePath("/panel/vencen-hoy"); revalidatePath("/panel"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
