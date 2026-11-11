"use server";
// F7.1 · Lo que los socios hacen solos, segunda parte: la pausa que se aprueba sola (con tope de días) y la ocupación en vivo en la app.
// Las dos vienen apagadas. Solo el dueño las cambia; la base valida y devuelve cómo quedó.
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

export type AutonomiaSocios = { pausa_autoaprobar: boolean; pausa_auto_max_dias: number; pausa_dias_por_anio: number; ocupacion_visible_socios: boolean };

export async function leerAutonomiaSocios(): Promise<{ estado?: AutonomiaSocios; error?: string }> {
  try {
    const g = (await contextoPanel()).gimnasio.id;
    return { estado: await rpc<AutonomiaSocios>("autonomia_socios_estado", { p_gimnasio_id: g }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function guardarAutonomiaSocios(pausaAuto: boolean, maxDias: number, ocupacion: boolean): Promise<{ estado?: AutonomiaSocios; error?: string }> {
  try {
    const g = (await contextoPanel()).gimnasio.id;
    const estado = await rpc<AutonomiaSocios>("guardar_autonomia_socios", { p_gimnasio_id: g, p_pausa_autoaprobar: pausaAuto, p_pausa_auto_max_dias: maxDias, p_ocupacion_visible: ocupacion });
    revalidatePath("/panel", "layout");
    return { estado };
  } catch (e) { return { error: (e as Error).message }; }
}
