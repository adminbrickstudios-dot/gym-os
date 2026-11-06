"use server";
import { revalidatePath } from "next/cache";
import { MAX_TEXTO } from "@/lib/mensajes";
import { subirFotoMensaje } from "@/lib/mensajes-servidor";
import { rpc } from "@/lib/panel/servidor";
import { notificarDespues } from "@/lib/push";

type Resp = { error?: string; aviso?: string; hilo_id?: string };
type Creado = { hilo_id: string; mensaje_id: string };

const foto = (datos: FormData) => { const f = datos.get("foto"); return f instanceof Blob && f.size > 0 ? f : null; };

async function despuesDeEscribir(c: Creado, f: Blob | null): Promise<Resp> {
  notificarDespues("mensaje_nuevo", c.mensaje_id);   // PUSH-1: al equipo que los ve
  revalidatePath("/app/mensajes"); revalidatePath("/app/yo");
  if (!f) return { hilo_id: c.hilo_id };
  const r = await subirFotoMensaje(c.mensaje_id, f);
  return { hilo_id: c.hilo_id, aviso: r.error };
}

/** VD-38: el socio le escribe al gimnasio (motivo, texto y una foto opcional). El texto queda aunque la foto falle. */
export async function enviarMensaje(datos: FormData): Promise<Resp> {
  const texto = String(datos.get("texto") ?? "").trim();
  if (!texto) return { error: "Escribí tu mensaje" };
  if (texto.length > MAX_TEXTO) return { error: `El mensaje es muy largo: hasta ${MAX_TEXTO} letras` };
  try {
    const c = await rpc<Creado>("escribir_al_gimnasio", { p_socio_id: String(datos.get("socio") ?? ""), p_motivo: String(datos.get("motivo") ?? ""), p_texto: texto });
    return await despuesDeEscribir(c, foto(datos));
  } catch (e) { return { error: (e as Error).message }; }
}

/** El socio sigue la conversación (si estaba resuelta, vuelve a "nuevo" para el gimnasio). */
export async function responderAlGimnasio(datos: FormData): Promise<Resp> {
  const texto = String(datos.get("texto") ?? "").trim();
  if (!texto) return { error: "Escribí tu mensaje" };
  if (texto.length > MAX_TEXTO) return { error: `El mensaje es muy largo: hasta ${MAX_TEXTO} letras` };
  try {
    const c = await rpc<Creado>("responder_hilo_socio", { p_hilo_id: String(datos.get("hilo") ?? ""), p_texto: texto });
    revalidatePath(`/app/mensajes/${c.hilo_id}`);
    return await despuesDeEscribir(c, foto(datos));
  } catch (e) { return { error: (e as Error).message }; }
}
