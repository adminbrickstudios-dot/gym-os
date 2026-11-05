"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, ErrorDatos, rpc } from "@/lib/panel/servidor";

export type ResultadoSocio = { socio_id: string; numero: number; nombre: string; color: string; texto: string; puede: boolean; dado_de_baja: boolean };

/** Búsqueda del Ctrl+K. Si el rol no puede buscar socios, devuelve el error (no una lista vacía). */
export async function buscarSociosRapido(texto: string): Promise<{ socios?: ResultadoSocio[]; error?: string }> {
  const panel = await contextoPanel();
  try {
    const socios = await rpc<ResultadoSocio[]>("buscar_socios", { p_gimnasio_id: panel.gimnasio.id, p_texto: texto, p_limite: 6 });
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
