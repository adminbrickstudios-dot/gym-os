"use server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";
import { frenarEnvioPublico } from "@/lib/seguridad/envio-publico";

export type EstadoAnotarse = { ok?: boolean; estado?: "anotado" | "espera"; posicion?: number; precio?: number; error?: string; datos?: { nombre: string; dni: string; telefono: string } };

/** VD-19: anotarse a un evento desde la página (sin sesión). La base valida el gimnasio publicado, el cupo y la lista de espera; se paga en recepción. */
export async function anotarseEvento(eventoId: string, _: EstadoAnotarse, form: FormData): Promise<EstadoAnotarse> {
  const datos = { nombre: String(form.get("nombre") ?? "").trim(), dni: String(form.get("dni") ?? "").trim(), telefono: String(form.get("telefono") ?? "").trim() };
  // SEG-04: campo trampa, tiempo mínimo y tope por conexión y por persona (el DNI), como el alta.
  const freno = await frenarEnvioPublico(form, "otro", datos.dni || null);
  if (freno.robot) return { ok: true, estado: "anotado" };
  if (freno.error) return { error: freno.error, datos };
  const h = await headers();
  const host = h.get("x-gymos-contexto") === "gimnasio" ? h.get("x-gimnasio-host") : null;
  if (!host) return { error: "No se pudo saber de qué gimnasio es esta página.", datos };
  // Sin código de país se asume Argentina (+54), como lo escribe la gente en WhatsApp.
  const digitos = datos.telefono.replace(/\D/g, "").replace(/^0+/, "");
  const telefono = datos.telefono.trim().startsWith("+") ? `+${digitos}` : `+${digitos.startsWith("54") ? digitos : `54${digitos}`}`;
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("inscribirse_evento_publico", { p_host: host, p_evento_id: eventoId, p_nombre: datos.nombre, p_dni: datos.dni, p_telefono: telefono });
  if (error) return { error: error.message, datos };
  const r = data as { estado: "anotado" | "espera"; posicion?: number; precio?: number };
  return { ok: true, estado: r.estado, posicion: r.posicion, precio: r.precio };
}

export type EstadoProbar ={ ok?: boolean; nombre?: string; error?: string; datos?: { nombre: string; telefono: string; interes: string } };

/** "Probá una clase": lo decide la base (gimnasio publicado, sección visible, tope contra spam). */
export async function quieroProbar(_: EstadoProbar, form: FormData): Promise<EstadoProbar> {
  const datos = { nombre: String(form.get("nombre") ?? "").trim(), telefono: String(form.get("telefono") ?? "").trim(), interes: String(form.get("interes") ?? "").trim() };
  // SEG-04: el campo escondido lo llenan los robots (se les contesta como si nada); además tiempo mínimo y tope de envíos.
  const freno = await frenarEnvioPublico(form, "consulta", datos.telefono || null);
  if (freno.robot) return { ok: true, nombre: datos.nombre.split(" ")[0] };
  if (freno.error) return { error: freno.error, datos };
  const h = await headers();
  const host = h.get("x-gymos-contexto") === "gimnasio" ? h.get("x-gimnasio-host") : null;
  if (!host) return { error: "No se pudo saber de qué gimnasio es esta página.", datos };
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { error } = await supabase.rpc("quiero_probar", { p_host: host, p_nombre: datos.nombre, p_telefono: datos.telefono, p_interes: datos.interes || null, p_ref: String(form.get("ref") ?? "") || null });
  if (error) return { error: error.message, datos };
  return { ok: true, nombre: datos.nombre.split(" ")[0] };
}

/** VD-51 · Las clases que se pueden probar gratis desde la página (vacío si el gimnasio no da prueba, no hay clases o esto es una vista previa). */
export type ClaseParaProbar = { clase_id: string; texto: string; sede: string };
export async function clasesParaProbar(): Promise<ClaseParaProbar[]> {
  const h = await headers();
  const host = h.get("x-gymos-contexto") === "gimnasio" ? h.get("x-gimnasio-host") : null;
  if (!host) return [];
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("clases_para_probar", { p_host: host });
  return error || !Array.isArray(data) ? [] : (data as ClaseParaProbar[]);
}

export type EstadoReservaPrueba = { ok?: boolean; nombre?: string; clase?: string; error?: string; datos?: { nombre: string; dni: string; telefono: string; clase: string } };

/** VD-51 · "Probá una clase": elige la clase y deja nombre, DNI y celular. Queda como Interesado con la reserva; lo decide la base. */
export async function reservarPrueba(_: EstadoReservaPrueba, form: FormData): Promise<EstadoReservaPrueba> {
  const datos = { nombre: String(form.get("nombre") ?? "").trim(), dni: String(form.get("dni") ?? "").trim(), telefono: String(form.get("telefono") ?? "").trim(), clase: String(form.get("clase") ?? "") };
  const freno = await frenarEnvioPublico(form, "prueba", datos.dni || null);
  if (freno.robot) return { ok: true, nombre: datos.nombre.split(" ")[0] };
  if (freno.error) return { error: freno.error, datos };
  const h = await headers();
  const host = h.get("x-gymos-contexto") === "gimnasio" ? h.get("x-gimnasio-host") : null;
  if (!host) return { error: "No se pudo saber de qué gimnasio es esta página.", datos };
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("reservar_prueba_publica", { p_host: host, p_clase_id: datos.clase, p_nombre: datos.nombre, p_dni: datos.dni, p_telefono: datos.telefono });
  if (error) return { error: error.message, datos };
  return { ok: true, nombre: datos.nombre.split(" ")[0], clase: (data as { clase: string }).clase };
}
