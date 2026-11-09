"use server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";

export type Transferencia = { alias: string | null; cbu: string | null; titular: string | null; banco: string | null };
export type ResultadoAlta = {
  error?: string; ya_socio?: boolean; listo?: boolean; nombre?: string; plan?: string; precio?: number | string | null;
  medio?: "transferencia" | "mostrador"; transferencia?: Transferencia | null; datos?: Record<string, string>;
  linkContrasena?: string;
};

/** Hacerse socio: lo decide la base (altas prendidas, plan válido, reglamento vigente, sin duplicar). */
export async function altaOnline(_: ResultadoAlta, form: FormData): Promise<ResultadoAlta> {
  const campos = ["plan", "nombre", "apellido", "dni", "telefono", "email", "fecha_nacimiento", "medio", "version", "acepto"] as const;
  const datos = Object.fromEntries(campos.map((c) => [c, String(form.get(c) ?? "").trim()])) as Record<(typeof campos)[number], string>;
  if (String(form.get("sitio") ?? "")) return { listo: true, nombre: datos.nombre };   // robots
  if (!datos.plan) return { error: "Elegí un plan.", datos };
  if (!datos.fecha_nacimiento) return { error: "Escribí tu fecha de nacimiento: los menores de 18 se anotan en el gimnasio con un adulto.", datos };
  if (datos.acepto !== "si") return { error: "Para anotarte tenés que leer y aceptar el reglamento.", datos };
  const h = await headers();
  const host = h.get("x-gymos-contexto") === "gimnasio" ? h.get("x-gimnasio-host") : null;
  if (!host) return { error: "No se pudo saber de qué gimnasio es esta página.", datos };
  // BASE-8: tope de envíos (10 por hora por conexión, 3 por hora por persona). El campo trampa ya se resolvió arriba.
  {
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const { clienteServicio } = await import("@/lib/supabase/servicio");
    const { error: errTope } = await clienteServicio().rpc("registrar_envio_publico", { p_formulario: "alta_online", p_ip: ip, p_clave: datos.dni || datos.email || null });
    if (errTope) return { error: errTope.message, datos };
  }
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("alta_online", {
    p_host: host, p_plan_id: datos.plan, p_version: Number(datos.version), p_medio: datos.medio,
    p_datos: { nombre: datos.nombre, apellido: datos.apellido, dni: datos.dni, telefono: datos.telefono, email: datos.email, fecha_nacimiento: datos.fecha_nacimiento },
  });
  if (error) return { error: error.message, datos };
  const r = data as { ya_socio: boolean; plan?: string; precio?: number | string | null; medio?: "transferencia" | "mostrador"; transferencia?: Transferencia | null };
  if (r.ya_socio) return { ya_socio: true, nombre: datos.nombre };
  // F1.2 (D43): con mail, el alta trae el link para crear su contraseña. Si no se puede armar, el alta igual quedó hecha
  // y entra con el código a su celular o a su mail.
  let linkContrasena: string | undefined;
  if (datos.email) {
    try {
      const { prepararLinkContrasenaSocio } = await import("@/lib/app/acceso-socio-servidor");
      const origen = `${h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https")}://${host}`;
      linkContrasena = (await prepararLinkContrasenaSocio({ email: datos.email, nombre: datos.nombre, gimnasio: host, origen })).link;
    } catch { linkContrasena = undefined; }
  }
  return { listo: true, nombre: datos.nombre, plan: r.plan, precio: r.precio, medio: r.medio, transferencia: r.transferencia, linkContrasena };
}
