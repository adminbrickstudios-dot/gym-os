"use server";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

/** AVI-1: avisado ✓ (queda anotado quién y cuándo; ese aviso no vuelve otro día). */
export async function marcarAvisado(socioId: string, clave: string, referencia: string): Promise<{ error?: string }> {
  try { await rpc("marcar_avisado", { p_socio_id: socioId, p_clave: clave, p_referencia: referencia }); revalidatePath("/panel/avisos"); revalidatePath("/panel/vencen-hoy"); revalidatePath("/panel"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** APP-6: una novedad para la app de los socios (texto y hasta qué día se ve). */
export async function publicarNovedad(gimnasioId: string, texto: string, hasta: string): Promise<{ error?: string }> {
  try { await rpc("publicar_novedad", { p_gimnasio_id: gimnasioId, p_texto: texto, p_hasta: hasta }); revalidatePath("/panel/avisos"); revalidatePath("/app"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
export async function quitarNovedad(id: string): Promise<{ error?: string }> {
  try { await rpc("quitar_novedad", { p_novedad_id: id }); revalidatePath("/panel/avisos"); revalidatePath("/app"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
