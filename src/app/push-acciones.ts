"use server";
import { mandar, pushConfigurado } from "@/lib/push";
import { rpc } from "@/lib/panel/servidor";
import { gimnasioActual } from "@/lib/supabase/servidor";

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };
type Estado = { puede: string[]; tipos: string[] | null };

/** Lo que este dispositivo recibe y lo que el rol puede elegir (PUSH-1). */
export async function estadoPush(endpoint: string | null): Promise<Estado & { error?: string }> {
  try { const g = await gimnasioActual(); return await rpc<Estado>("suscripcion_push", { p_gimnasio_id: g.id, p_endpoint: endpoint }); }
  catch (e) { return { puede: [], tipos: null, error: (e as Error).message }; }
}

export async function guardarPush(sub: Sub, tipos: string[] | null): Promise<{ error?: string }> {
  try {
    const g = await gimnasioActual();
    await rpc("guardar_suscripcion_push", { p_gimnasio_id: g.id, p_endpoint: sub.endpoint, p_p256dh: sub.keys.p256dh, p_auth: sub.keys.auth, p_tipos: tipos });
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function borrarPush(endpoint: string): Promise<{ error?: string }> {
  try { const g = await gimnasioActual(); await rpc("borrar_suscripcion_push", { p_gimnasio_id: g.id, p_endpoint: endpoint }); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** Una de prueba, solo a un dispositivo que es de quien la pide. */
export async function probarPush(sub: Sub): Promise<{ error?: string }> {
  try {
    if (!pushConfigurado()) return { error: "Las notificaciones todavía no están configuradas (faltan las claves VAPID en Vercel)." };
    const g = await gimnasioActual();
    const e = await rpc<Estado>("suscripcion_push", { p_gimnasio_id: g.id, p_endpoint: sub.endpoint });
    if (!e.tipos) return { error: "Este dispositivo no está anotado: activá las notificaciones primero." };
    const ok = await mandar({ endpoint: sub.endpoint, ...sub.keys }, { titulo: "🔔 Así te van a llegar los avisos", cuerpo: "Esto es una prueba. Tocala para abrir.", url: "/" });
    return ok ? {} : { error: "El navegador dio de baja este dispositivo: volvé a activarlas." };
  } catch (e) { return { error: (e as Error).message }; }
}
