"use server";
// VD-53 · Horas del equipo. La base decide quién ve, quién corrige y cuánto suma cada turno.
import { revalidatePath } from "next/cache";
import type { HorasMes } from "@/lib/fichaje";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

type Resp = { error?: string };
export type Correccion = { fichaje_id: string; por: string; en: string; motivo: string; entrada_antes: string; salida_antes: string | null; entrada_nueva: string; salida_nueva: string };
export type DetallePersona = HorasMes & { correcciones: Correccion[] };

const hacer = async (f: () => Promise<unknown>): Promise<Resp> => {
  try { await f(); revalidatePath("/panel/horas"); revalidatePath("/panel/profes"); revalidatePath("/panel"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
};

export async function verPersona(equipoId: string, mes: string): Promise<{ detalle?: DetallePersona; error?: string }> {
  try {
    const p = await contextoPanel();
    return { detalle: await rpc<DetallePersona>("fichajes_persona", { p_gimnasio_id: p.gimnasio.id, p_equipo_id: equipoId, p_mes: mes }, { lectura: true }) };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function guardarConfigFichaje(usa: boolean, topeHoras: number): Promise<Resp & { usa?: boolean; tope_horas?: number }> {
  try {
    const p = await contextoPanel();
    const r = await rpc<{ usa: boolean; tope_horas: number }>("guardar_config_fichaje", { p_gimnasio_id: p.gimnasio.id, p_usa: usa, p_tope_horas: topeHoras });
    revalidatePath("/panel/horas"); revalidatePath("/panel");
    return r;
  } catch (e) { return { error: (e as Error).message }; }
}

/** Las horas se escriben como hora del gimnasio ("2026-11-05T14:30"); la base las convierte. */
export async function corregirTurno(fichajeId: string, entradaLocal: string, salidaLocal: string, motivo: string): Promise<Resp> {
  return hacer(() => rpc("corregir_fichaje", { p_fichaje_id: fichajeId, p_entrada_local: entradaLocal, p_salida_local: salidaLocal, p_motivo: motivo }));
}

export async function anularTurno(fichajeId: string, motivo: string): Promise<Resp> {
  return hacer(() => rpc("anular_fichaje", { p_fichaje_id: fichajeId, p_motivo: motivo }));
}
