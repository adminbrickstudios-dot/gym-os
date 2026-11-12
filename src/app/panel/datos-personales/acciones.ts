"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

/** Ley 25.326 (D52): el dueño escribe la política de privacidad; la base decide quién puede. */
export async function guardarPolitica(texto: string): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try { await rpc("guardar_politica_privacidad", { p_gimnasio_id: panel.gimnasio.id, p_texto: texto }); revalidatePath("/panel/datos-personales"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** WEB-06: los términos y condiciones del gimnasio. Se guardan sin publicar; publicar es una decisión del dueño. */
export async function guardarTerminos(texto: string, publicado: boolean): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try { await rpc("guardar_terminos", { p_gimnasio_id: panel.gimnasio.id, p_texto: texto, p_publicado: publicado }); revalidatePath("/panel/datos-personales"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** Marcar un pedido del socio (ver, corregir o borrar sus datos) como resuelto, con lo que se hizo. */
export async function resolverPedido(pedidoId: string, nota: string): Promise<{ error?: string }> {
  await contextoPanel();
  try { await rpc("resolver_pedido_datos", { p_pedido_id: pedidoId, p_nota: nota }); revalidatePath("/panel/datos-personales"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
