import "server-only";
import { after } from "next/server";
import webpush from "web-push";
import { clienteServicio } from "@/lib/supabase/servicio";

/**
 * PUSH-1: web push con claves VAPID propias. El servidor manda DESPUÉS de que
 * la base confirmó el hecho; a quién y con qué texto lo decide la base
 * (`destinos_push`), que además no deja mandar dos veces lo mismo. Si no
 * llega, nada se pierde: todo está en la campana (AVI-5).
 */
export type EventoPush = "comprobante" | "pago_resuelto" | "caja_diferencia" | "caja_retiro" | "pedido_anulacion" | "clase_cancelada" | "mensaje_nuevo" | "mensaje_respuesta" | "lugar_liberado";
export type Mensaje = { titulo: string; cuerpo: string; url: string };
type Destinos = Mensaje & { tipo: string; destinos: { endpoint: string; p256dh: string; auth: string }[] };

export const pushConfigurado = () =>
  !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUJETO);

function configurar() {
  webpush.setVapidDetails(process.env.VAPID_SUJETO!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
}

/** Manda un mensaje a una suscripción. `false` si el navegador ya la dio de baja (404/410). */
export async function mandar(sub: { endpoint: string; p256dh: string; auth: string }, m: Mensaje): Promise<boolean> {
  configurar();
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(m), { TTL: 60 * 60 * 24, urgency: "normal" });
    return true;
  } catch (e) {
    const codigo = (e as { statusCode?: number }).statusCode;
    if (codigo === 404 || codigo === 410) return false;
    throw e;
  }
}

export async function notificar(evento: EventoPush, id: string): Promise<{ enviados: number; bajas: number; fallas: number } | null> {
  if (!pushConfigurado()) { console.warn(`[push] sin claves VAPID: no se manda ${evento}`); return null; }
  const db = clienteServicio();
  // VD-38: los mensajes de los socios tienen su propia función (destinos_push no se toca).
  const { data, error } = await db.rpc(evento.startsWith("mensaje_") ? "destinos_push_mensajes" : evento === "lugar_liberado" ? "destinos_push_clases" : "destinos_push", { p_evento: evento, p_id: id });
  if (error) { console.error(`[push] ${evento} ${id}: ${error.message}`); return null; }
  const d = data as Destinos | null;
  if (!d) return { enviados: 0, bajas: 0, fallas: 0 };   // ya se mandó o el hecho no aplica
  const r = { enviados: 0, bajas: 0, fallas: 0 };
  await Promise.all(d.destinos.map(async (x) => {
    try {
      if (await mandar(x, d)) r.enviados++;
      else { r.bajas++; await db.rpc("baja_push", { p_endpoint: x.endpoint }); }
    } catch (e) { r.fallas++; console.error(`[push] ${evento}: ${(e as Error).message}`); }
  }));
  return r;
}

/** Después de responder: la acción no espera al envío. */
export function notificarDespues(evento: EventoPush, id: string | null | undefined) {
  if (!id) return;
  after(() => notificar(evento, id).then(() => undefined, (e) => console.error(`[push] ${evento}: ${(e as Error).message}`)));
}
