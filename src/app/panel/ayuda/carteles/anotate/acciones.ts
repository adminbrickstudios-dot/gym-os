"use server";
// C9 · El plan que llega elegido cuando alguien abre el QR o el link "Anotate acá". Solo el dueño lo cambia; la base valida que el plan
// esté activo y visible en la página. Elegir un plan no da acceso: quien se anota queda sin pagar.
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

export type QrAltaPanel = {
  abierto: boolean; tiene_reglamento: boolean; publicada: boolean; whatsapp: string | null;
  plan_sugerido_id: string | null; planes: { id: string; nombre: string; tipo: string }[];
};

export async function guardarPlanSugerido(planId: string | null): Promise<{ error?: string; panel?: QrAltaPanel }> {
  try {
    const g = (await contextoPanel()).gimnasio.id;
    const panel = await rpc<QrAltaPanel>("guardar_alta_plan_sugerido", { p_gimnasio_id: g, p_plan_id: planId });
    revalidatePath("/", "layout");
    return { panel };
  } catch (e) { return { error: (e as Error).message }; }
}
