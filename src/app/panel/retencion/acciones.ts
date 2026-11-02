"use server";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

export async function anotarContacto(socioId: string, lista: string, resultado: string): Promise<{ error?: string }> {
  try {
    await rpc("registrar_contacto", { p_socio_id: socioId, p_lista: lista, p_canal: "whatsapp", p_resultado: resultado });
    revalidatePath("/panel/retencion");
    revalidatePath("/panel/vencen-hoy");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
