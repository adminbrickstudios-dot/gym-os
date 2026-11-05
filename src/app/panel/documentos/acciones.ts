"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

/** COM-6: publicar una versión nueva (solo el dueño; la base lo decide). */
export async function guardarDocumento(clave: string, titulo: string, texto: string): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try { await rpc("guardar_documento", { p_gimnasio_id: panel.gimnasio.id, p_clave: clave, p_titulo: titulo, p_texto: texto }); revalidatePath("/panel/documentos"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

export async function archivarDocumento(clave: string): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try { await rpc("archivar_documento", { p_gimnasio_id: panel.gimnasio.id, p_clave: clave }); revalidatePath("/panel/documentos"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** Firma en el mostrador (o desde la app: la base sabe quién es por la sesión). */
export async function firmarDocumento(documentoId: string, socioId: string, nombre: string): Promise<{ error?: string }> {
  // Sin revalidar: si la página se vuelve a pedir, el documento ya no está pendiente y el
  // "Firmado" desaparece antes de que se lea. La próxima vez que se abra ya viene sin él.
  try { await rpc("firmar_documento", { p_documento_id: documentoId, p_socio_id: socioId, p_nombre: nombre }); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
