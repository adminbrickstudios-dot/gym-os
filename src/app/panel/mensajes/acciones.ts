"use server";
import { revalidatePath } from "next/cache";
import { MAX_TEXTO } from "@/lib/mensajes";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { notificarDespues } from "@/lib/push";

type Resp = { error?: string };
const hacer = async (f: () => Promise<unknown>): Promise<Resp> => {
  try { await f(); revalidatePath("/panel/mensajes"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
};

/** VD-38: el equipo contesta. Queda escrito quién, el hilo pasa a "en curso" y al socio le llega el aviso. */
export async function responder(hiloId: string, texto: string): Promise<Resp> {
  const t = texto.trim();
  if (!t) return { error: "Escribí la respuesta" };
  if (t.length > MAX_TEXTO) return { error: `La respuesta es muy larga: hasta ${MAX_TEXTO} letras` };
  return hacer(async () => {
    const r = await rpc<{ mensaje_id: string }>("responder_mensaje", { p_hilo_id: hiloId, p_texto: t });
    notificarDespues("mensaje_respuesta", r.mensaje_id);
  });
}

export const cambiarEstado = async (hiloId: string, estado: string): Promise<Resp> => hacer(() => rpc("cambiar_estado_hilo", { p_hilo_id: hiloId, p_estado: estado }));

export const guardarRespuestaRapida = async (id: string | null, titulo: string, texto: string): Promise<Resp> =>
  hacer(async () => { const p = await contextoPanel(); await rpc("guardar_respuesta_rapida", { p_gimnasio_id: p.gimnasio.id, p_id: id, p_titulo: titulo, p_texto: texto }); });

export const quitarRespuestaRapida = async (id: string): Promise<Resp> =>
  hacer(async () => { const p = await contextoPanel(); await rpc("quitar_respuesta_rapida", { p_gimnasio_id: p.gimnasio.id, p_id: id }); });

/** Solo el dueño: si la recepción también ve los mensajes. */
export const guardarRecepcionVe = async (valor: boolean): Promise<Resp> =>
  hacer(async () => { const p = await contextoPanel(); await rpc("guardar_permisos_mensajes", { p_gimnasio_id: p.gimnasio.id, p_recepcion_ve: valor }); });
