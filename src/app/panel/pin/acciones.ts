"use server";
import { cookies } from "next/headers";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { COOKIE_OPERADOR } from "@/lib/supabase/servidor";

const COOKIE_NOMBRE = "gymos_operador_nombre";
const DURA = 12 * 3600 - 300;   // un poco menos que el token: nunca se manda uno vencido
const opciones = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: DURA };

/** CAJ-3: quien atiende pone su PIN; lo que haga queda anotado a su nombre (nunca con más permisos que la sesión). */
export async function entrarConPin(_: { error?: string; ir?: string }, f: FormData): Promise<{ error?: string; ir?: string }> {
  const pin = String(f.get("pin") ?? "").trim();
  const volver = String(f.get("volver") ?? "/panel");
  if (!/^\d{4}$/.test(pin)) return { error: "El PIN son 4 números" };
  const panel = await contextoPanel();
  let r: { token?: string; nombre?: string; error?: string; quedan?: number };
  try { r = await rpc("entrar_con_pin", { p_gimnasio_id: panel.gimnasio.id, p_pin: pin }); }
  catch (e) { return { error: (e as Error).message }; }
  if (r.error) return { error: r.quedan ? `${r.error}: te quedan ${r.quedan} intento${r.quedan === 1 ? "" : "s"}` : `${r.error}: esperá 10 minutos` };
  const almacen = await cookies();
  almacen.set(COOKIE_OPERADOR, r.token!, opciones);
  almacen.set(COOKIE_NOMBRE, r.nombre!, opciones);
  // La pantalla navega entera (el aviso "Atiende …" está en el layout y todo pasa a ir con el PIN).
  return { ir: volver.startsWith("/panel") ? volver : "/panel" };
}

export async function salirDelPin(): Promise<{ ir: string }> {
  const almacen = await cookies();
  almacen.delete(COOKIE_OPERADOR);
  almacen.delete(COOKIE_NOMBRE);
  return { ir: "/panel/pin" };
}

export async function guardarMiPin(pin: string): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try { await rpc("guardar_mi_pin", { p_gimnasio_id: panel.gimnasio.id, p_pin: pin.trim() }); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
