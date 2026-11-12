"use server";
import { cookies } from "next/headers";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

export type Tema = "gimnasio" | "claro" | "oscuro";
const COOKIE_TEMA = "tema";

/**
 * El tema vale en todos los dispositivos: en uno nuevo (sin la cookie) se lee el de la base y se deja la cookie.
 * Devuelve el tema si hubo que aplicarlo (la pantalla se repinta), o null si no hay nada que cambiar.
 */
export async function sincronizarTema(): Promise<Tema | null> {
  const almacen = await cookies();
  if (almacen.get(COOKIE_TEMA)?.value) return null;
  const panel = await contextoPanel();
  const t = await rpc<string | null>("mi_tema", { p_gimnasio_id: panel.gimnasio.id }, { lectura: true }).catch(() => null);
  if (t !== "claro" && t !== "oscuro") return null;
  almacen.set(COOKIE_TEMA, t, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return t;
}

/** BASE-6 (D37): guardar el tema de esta persona en la base (vale en todos sus dispositivos) y en la cookie que lee el layout. */
export async function guardarTema(tema: Tema): Promise<{ error?: string }> {
  if (!["gimnasio", "claro", "oscuro"].includes(tema)) return { error: "El tema es claro, oscuro o como el gimnasio." };
  const panel = await contextoPanel();
  try {
    await rpc("guardar_tema_usuario", { p_gimnasio_id: panel.gimnasio.id, p_tema: tema === "gimnasio" ? null : tema });
  } catch (e) { return { error: (e as Error).message }; }
  const almacen = await cookies();
  if (tema === "gimnasio") almacen.delete(COOKIE_TEMA);
  else almacen.set(COOKIE_TEMA, tema, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return {};
}
