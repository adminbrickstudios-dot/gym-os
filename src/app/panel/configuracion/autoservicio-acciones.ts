"use server";
// VD-35 / VD-39 · Lo que los socios hacen solos: anotarse desde la página y comprar o cambiar de plan desde la app.
// Solo el dueño prende o apaga; la base valida (el registro no se abre sin reglamento) y devuelve cómo quedó.
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

export type AutoservicioPanel = { abierto: boolean; tiene_reglamento: boolean; publicada: boolean; anotados_web: number; compras_app: boolean };

export async function guardarRegistroAbierto(abierto: boolean): Promise<{ error?: string; panel?: AutoservicioPanel }> {
  try {
    const g = (await contextoPanel()).gimnasio.id;
    const panel = await rpc<AutoservicioPanel & { compras_app?: boolean }>("guardar_registro_socios", { p_gimnasio_id: g, p_abierto: abierto });
    revalidatePath("/", "layout");
    return { panel: { ...panel, compras_app: panel.compras_app ?? true } };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function guardarComprasApp(activo: boolean): Promise<{ error?: string; panel?: AutoservicioPanel }> {
  try {
    const g = (await contextoPanel()).gimnasio.id;
    const panel = await rpc<AutoservicioPanel>("guardar_compras_app", { p_gimnasio_id: g, p_activo: activo });
    revalidatePath("/panel", "layout");
    return { panel };
  } catch (e) { return { error: (e as Error).message }; }
}
