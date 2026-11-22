"use server";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

/** Prende o apaga la página de venta nueva. La base decide si quien llama es super admin (si no, error). */
export async function guardarLlaveLandingVenta(activa: boolean): Promise<{ error?: string }> {
  try {
    const r = await rpc<boolean>("admin_guardar_landing_venta", { p_activa: activa });
    if (r !== activa) return { error: "La base no confirmó el cambio. Probá de nuevo." };
    revalidatePath("/"); revalidatePath("/admin/vista-landing");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
