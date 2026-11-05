"use server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";

export type EstadoProbar = { ok?: boolean; nombre?: string; error?: string; datos?: { nombre: string; telefono: string; interes: string } };

/** "Probá una clase": lo decide la base (gimnasio publicado, sección visible, tope contra spam). */
export async function quieroProbar(_: EstadoProbar, form: FormData): Promise<EstadoProbar> {
  const datos = { nombre: String(form.get("nombre") ?? "").trim(), telefono: String(form.get("telefono") ?? "").trim(), interes: String(form.get("interes") ?? "").trim() };
  // El campo escondido lo llenan los robots: se les contesta como si nada, sin guardar.
  if (String(form.get("sitio") ?? "")) return { ok: true, nombre: datos.nombre.split(" ")[0] };
  const h = await headers();
  const host = h.get("x-gymos-contexto") === "gimnasio" ? h.get("x-gimnasio-host") : null;
  if (!host) return { error: "No se pudo saber de qué gimnasio es esta página.", datos };
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { error } = await supabase.rpc("quiero_probar", { p_host: host, p_nombre: datos.nombre, p_telefono: datos.telefono, p_interes: datos.interes || null, p_ref: String(form.get("ref") ?? "") || null });
  if (error) return { error: error.message, datos };
  return { ok: true, nombre: datos.nombre.split(" ")[0] };
}
