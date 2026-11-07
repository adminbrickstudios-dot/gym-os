"use server";
import { rpc } from "@/lib/panel/servidor";

/** VD-31: anota en la base que esta persona ya vio la ayuda de una pantalla (idempotente). */
export async function marcarAyuda(clave: string): Promise<{ error?: string }> {
  try { await rpc("marcar_ayuda", { p_clave: clave }); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** VD-31: "No me muestres más ayudas" (o volver a mostrarlas), para siempre y en todos mis dispositivos. */
export async function apagarAyudas(apagar: boolean): Promise<{ error?: string }> {
  try { await rpc("apagar_ayudas", { p_apagar: apagar }); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** VD-31: "Volver a ver las ayudas": borra lo que ya vi. Devuelve cuántas había. */
export async function reiniciarAyudas(): Promise<{ error?: string; cuantas?: number }> {
  try { return { cuantas: await rpc<number>("reiniciar_ayudas") }; }
  catch (e) { return { error: (e as Error).message }; }
}
