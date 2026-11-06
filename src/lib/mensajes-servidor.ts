import "server-only";
import { achicarFoto } from "@/lib/imagenes-servidor";
import { fotoValida, type MensajeHilo } from "@/lib/mensajes";
import { rpc } from "@/lib/panel/servidor";
import { clienteServicio } from "@/lib/supabase/servicio";

const BUCKET = "mensajes_fotos";

/**
 * VD-38: la foto de un mensaje. El mensaje ya quedó escrito; la base arma la ruta (y verifica que el mensaje
 * sea de quien lo pide), el servidor achica y sube con la clave de servicio, y la base la confirma.
 * Si la foto falla, el texto no se pierde: se devuelve el motivo.
 */
export async function subirFotoMensaje(mensajeId: string, foto: Blob): Promise<{ error?: string }> {
  const mal = fotoValida(foto);
  if (mal) return { error: mal };
  try {
    const a = await achicarFoto(new Uint8Array(await foto.arrayBuffer()), foto.type as "image/jpeg" | "image/png" | "image/webp");
    const ext = a.mime === "image/png" ? "png" : a.mime === "image/webp" ? "webp" : "jpg";
    const ruta = await rpc<string>("preparar_foto_mensaje", { p_mensaje_id: mensajeId, p_ext: ext });
    const { error } = await clienteServicio().storage.from(BUCKET).upload(ruta, Buffer.from(a.bytes), { contentType: a.mime, upsert: false });
    if (error) return { error: `Tu mensaje se envió, pero la foto no se pudo subir: ${error.message}` };
    await rpc("confirmar_foto_mensaje", { p_mensaje_id: mensajeId, p_ruta: ruta });
    return {};
  } catch (e) { return { error: `Tu mensaje se envió, pero la foto no se pudo subir: ${(e as Error).message}` }; }
}

/** Les pone el link (10 minutos) a las fotos de un hilo: la base dice antes si quien mira puede verlas. */
export async function conFotos(mensajes: MensajeHilo[]): Promise<MensajeHilo[]> {
  const con = mensajes.filter((m) => m.con_foto);
  if (!con.length) return mensajes;
  const db = clienteServicio();
  const urls = new Map<string, string>();
  await Promise.all(con.map(async (m) => {
    try {
      const ruta = await rpc<string | null>("foto_mensaje", { p_mensaje_id: m.id }, { lectura: true });
      if (!ruta) return;
      const { data } = await db.storage.from(BUCKET).createSignedUrl(ruta, 600);
      if (data?.signedUrl) urls.set(m.id, data.signedUrl);
    } catch { /* sin link: se ve "la foto no se pudo abrir" */ }
  }));
  return mensajes.map((m) => (m.con_foto ? { ...m, foto_url: urls.get(m.id) ?? null } : m));
}
