"use server";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { traerCampana } from "./datos";

/** Cuántos avisos nuevos (para el 🔔). Si falla, null: la campana no muestra un cero que no es. */
export async function contarCampana(): Promise<number | null> {
  try { return (await traerCampana()).sinLeer; } catch { return null; }
}

export async function leerCampana(claves: string[]): Promise<{ error?: string }> {
  try {
    const panel = await contextoPanel();
    await rpc("leer_campana", { p_gimnasio_id: panel.gimnasio.id, p_claves: claves.slice(0, 300) });
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
