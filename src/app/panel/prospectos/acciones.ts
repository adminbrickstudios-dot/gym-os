"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

export async function cambiarEstado(id: string, estado: string): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("actualizar_prospecto", { p_gimnasio_id: panel.gimnasio.id, p_prospecto_id: id, p_estado: estado, p_nota: null });
    revalidatePath("/panel/prospectos");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function agregarProspecto(_: { error?: string; ok?: number }, form: FormData): Promise<{ error?: string; ok?: number }> {
  const panel = await contextoPanel();
  try {
    await rpc("crear_prospecto", {
      p_gimnasio_id: panel.gimnasio.id, p_nombre: String(form.get("nombre") ?? ""), p_telefono: String(form.get("telefono") ?? ""),
      p_interes: String(form.get("interes") ?? "") || null, p_origen: String(form.get("origen") ?? "recepcion"),
    });
    revalidatePath("/panel/prospectos");
    return { ok: Date.now() };
  } catch (e) { return { error: (e as Error).message }; }
}
