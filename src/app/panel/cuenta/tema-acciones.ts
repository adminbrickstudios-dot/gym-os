"use server";
import { cookies } from "next/headers";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

export type Tema = "gimnasio" | "claro" | "oscuro";
const COOKIE_TEMA = "tema";

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
