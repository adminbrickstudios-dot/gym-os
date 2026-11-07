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

/** VD-37: "Marcar todo como leído" — todo lo que hoy figura como nuevo en MI campana (ya sin lo que apagué). */
export async function marcarTodoLeido(): Promise<{ error?: string; marcados?: number }> {
  try {
    const { panel, items } = await traerCampana();
    const claves = items.filter((i) => !i.leido).map((i) => i.clave);
    for (let i = 0; i < claves.length; i += 300) {
      await rpc("leer_campana", { p_gimnasio_id: panel.gimnasio.id, p_claves: claves.slice(i, i + 300) });
    }
    return { marcados: claves.length };
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-37: prender o apagar un tipo de aviso en la campana. La base verifica que el tipo sea de mi rol. */
export async function guardarPreferenciaAviso(tipo: string, activo: boolean): Promise<{ error?: string }> {
  try {
    const panel = await contextoPanel();
    await rpc("guardar_preferencia_aviso", { p_gimnasio_id: panel.gimnasio.id, p_tipo: tipo, p_canal: "app", p_activo: activo });
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
