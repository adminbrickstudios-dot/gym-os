"use server";
import { textoDeBase } from "@/lib/errores-humanos";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";
import { frenarEnvioPublico } from "@/lib/seguridad/envio-publico";

export type EstadoDemo = { ok?: boolean; nombre?: string; error?: string; datos?: { nombre: string; gimnasio: string; contacto: string; mensaje: string } };

/** VD-26: "Quiero una demo" en la página de Gym OS (sin sesión). La base valida, pone el tope contra spam y lo deja para BRIK en /admin. */
export async function pedirDemo(_: EstadoDemo, form: FormData): Promise<EstadoDemo> {
  const datos = {
    nombre: String(form.get("nombre") ?? "").trim(), gimnasio: String(form.get("gimnasio") ?? "").trim(),
    contacto: String(form.get("contacto") ?? "").trim(), mensaje: String(form.get("mensaje") ?? "").trim(),
  };
  // D49: el campo escondido lo llenan los robots (se les contesta como si nada, sin guardar); menos de 3 segundos abierta la
  // página no es una persona; y tope por conexión y por contacto (10 y 3 por hora).
  const freno = await frenarEnvioPublico(form, "consulta", datos.contacto || null);
  if (freno.robot) return { ok: true, nombre: datos.nombre.split(" ")[0] };
  if (freno.error) return { error: freno.error, datos };
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { error } = await supabase.rpc("pedir_demo_brik", { p_nombre: datos.nombre, p_gimnasio: datos.gimnasio, p_contacto: datos.contacto, p_mensaje: datos.mensaje });
  if (error) return { error: textoDeBase(error), datos };
  return { ok: true, nombre: datos.nombre.split(" ")[0] };
}
