"use server";
// Vuelto en efectivo al cobrar: un interruptor por gimnasio, apagado por defecto. Solo el dueño lo cambia; la base lo verifica.
// Es solo una cuenta en la hoja Cobrar: no cambia ningún monto cobrado.
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

export async function leerVuelto(): Promise<{ activo?: boolean; error?: string }> {
  try {
    const g = (await contextoPanel()).gimnasio.id;
    return { activo: await rpc<boolean>("vuelto_efectivo_activo", { p_gimnasio_id: g }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function guardarVuelto(activo: boolean): Promise<{ activo?: boolean; error?: string }> {
  try {
    const g = (await contextoPanel()).gimnasio.id;
    const r = await rpc<boolean>("guardar_vuelto_efectivo", { p_gimnasio_id: g, p_activo: activo });
    revalidatePath("/panel", "layout");
    return { activo: r };
  } catch (e) { return { error: (e as Error).message }; }
}
