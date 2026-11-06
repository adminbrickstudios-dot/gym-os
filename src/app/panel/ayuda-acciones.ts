"use server";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

/** VD-40: el dueño (o el encargado) le escribe a BRIK. Viaja el contexto: gimnasio, quién, pantalla y último error. */
export async function pedirAyudaBrik(mensaje: string, pantalla: string, ultimoError: string | null): Promise<{ error?: string }> {
  try {
    const panel = await contextoPanel();
    await rpc("pedir_ayuda_brik", { p_gimnasio_id: panel.gimnasio.id, p_mensaje: mensaje, p_pantalla: pantalla, p_error: ultimoError });
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
