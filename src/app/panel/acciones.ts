"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, ErrorDatos, rpc } from "@/lib/panel/servidor";

export type ResultadoSocio = { socio_id: string; numero: number | null; nombre: string; color: string; texto: string; puede: boolean; dado_de_baja: boolean; tiene_foto?: boolean };

/** Búsqueda del Ctrl+K. Si el rol no puede buscar socios, devuelve el error (no una lista vacía). */
export async function buscarSociosRapido(texto: string): Promise<{ socios?: ResultadoSocio[]; error?: string }> {
  const panel = await contextoPanel();
  try {
    // EQU-2 (D3): el profe busca con su función (nombre, foto y semáforo).
    const socios = panel.yo.rol === "profe"
      ? (await rpc<Omit<ResultadoSocio, "numero" | "dado_de_baja">[]>("buscar_socios_profe", { p_gimnasio_id: panel.gimnasio.id, p_texto: texto })).map((s) => ({ ...s, numero: null, dado_de_baja: false }))
      : await rpc<ResultadoSocio[]>("buscar_socios", { p_gimnasio_id: panel.gimnasio.id, p_texto: texto, p_limite: 6 });
    return { socios };
  } catch (e) {
    return { error: e instanceof ErrorDatos && e.sinPermiso ? "Tu rol no busca socios" : (e as Error).message };
  }
}

export async function guardarAccesos(claves: string[]): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_accesos_rapidos", { p_gimnasio_id: panel.gimnasio.id, p_accesos: claves });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/panel");
  return {};
}

/** "Primeros pasos" de Inicio: ocultarlos o volver a mostrarlos (solo el dueño, lo decide la base). */
export async function ocultarPrimerosPasos(ocultar: boolean): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("ocultar_primeros_pasos", { p_gimnasio_id: panel.gimnasio.id, p_ocultar: ocultar });
    revalidatePath("/panel");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** ADM-6: el dueño cierra una novedad de Gym OS (no vuelve a aparecerle). */
export async function cerrarNovedadGymOS(id: string): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try { await rpc("cerrar_novedad_plataforma", { p_gimnasio_id: panel.gimnasio.id, p_id: id }); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
