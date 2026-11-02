"use server";
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requerir } from "@/lib/entorno";
import { rpc } from "@/lib/panel/servidor";
import { clienteServicio } from "@/lib/supabase/servicio";

export type EstadoAlta = { error?: string; ok?: { host: string; email?: string; contrasena?: string; aviso: string } };

/**
 * Alta de un gimnasio. La base valida que quien lo pide es admin de la
 * plataforma (admin_crear_gimnasio con su sesión); recién después el
 * servidor crea o vincula la cuenta del dueño con la clave de servicio.
 */
export async function crearGimnasio(_: EstadoAlta, f: FormData): Promise<EstadoAlta> {
  const slug = String(f.get("slug") ?? "").trim().toLowerCase();
  const nombre = String(f.get("nombre") ?? "").trim();
  const dueno = String(f.get("dueno") ?? "").trim();
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  let r: { gimnasio_id: string; equipo_id: string; host: string };
  try {
    r = await rpc("admin_crear_gimnasio", { p_slug: slug, p_nombre: nombre, p_dominio_base: requerir("NEXT_PUBLIC_DOMINIO_BASE", process.env.NEXT_PUBLIC_DOMINIO_BASE), p_dueno_nombre: dueno });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath("/admin");
  if (!email) return { ok: { host: r.host, aviso: `${nombre} está creado. Falta darle acceso al dueño (cargá su mail).` } };

  const servicio = clienteServicio();
  const { data: existente, error: e1 } = await servicio.rpc("usuario_por_mail", { p_email: email });
  if (e1) return { error: `El gimnasio se creó, pero no se pudo dar acceso al dueño: ${e1.message}` };
  let usuario = existente as string | null;
  let contrasena: string | undefined;
  if (!usuario) {
    contrasena = `brik-${randomInt(100000, 999999)}`;
    const { data, error } = await servicio.auth.admin.createUser({ email, password: contrasena, email_confirm: true, user_metadata: { nombre: dueno } });
    if (error) return { error: `El gimnasio se creó, pero no la cuenta del dueño: ${error.message}` };
    usuario = data.user.id;
  }
  const { error: e2 } = await servicio.rpc("vincular_usuario_equipo", { p_equipo_id: r.equipo_id, p_usuario_id: usuario });
  if (e2) return { error: `El gimnasio se creó, pero no se pudo vincular al dueño: ${e2.message}` };
  return { ok: { host: r.host, email, contrasena, aviso: contrasena ? "Pasale al dueño su mail y esta contraseña provisoria." : "El dueño ya tenía cuenta: entra con la suya." } };
}
