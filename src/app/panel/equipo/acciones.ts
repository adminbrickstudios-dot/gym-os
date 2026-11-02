"use server";
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { clienteServicio } from "@/lib/supabase/servicio";

export type Resultado = { error?: string; aviso?: string; contrasena?: string; email?: string };
const PALABRAS = ["pesa", "disco", "barra", "banco", "soga", "remo", "salto", "plancha", "sentadilla", "kettle"];

/**
 * Agrega a alguien al equipo. Primero la base valida que quien lo pide es el
 * dueño (guardar_equipo con su sesión); recién después el servidor usa la
 * clave de servicio para crear o vincular la cuenta.
 */
export async function agregarPersona(_: Resultado, f: FormData): Promise<Resultado> {
  const panel = await contextoPanel();
  const nombre = String(f.get("nombre") ?? "").trim();
  const rol = String(f.get("rol") ?? "");
  const email = String(f.get("email") ?? "").trim().toLowerCase();
  const sede = String(f.get("sede") ?? "") || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "El mail no es válido" };
  let equipoId: string;
  try {
    equipoId = await rpc<string>("guardar_equipo", { p_gimnasio_id: panel.gimnasio.id, p_equipo_id: null, p_nombre: nombre, p_rol: rol, p_sede_id: sede });
  } catch (e) { return { error: (e as Error).message }; }
  revalidatePath("/panel/equipo");
  if (!email) return { aviso: `${nombre} quedó en el equipo sin acceso al sistema (aparece en la grilla de clases).` };

  const servicio = clienteServicio();
  const { data: existente, error: errBusca } = await servicio.rpc("usuario_por_mail", { p_email: email });
  if (errBusca) return { error: `${nombre} quedó en el equipo, pero no se pudo dar el acceso: ${errBusca.message}` };
  let usuarioId = existente as string | null;
  let contrasena: string | undefined;
  if (!usuarioId) {
    contrasena = `${PALABRAS[randomInt(PALABRAS.length)]}-${randomInt(1000, 9999)}-${PALABRAS[randomInt(PALABRAS.length)]}`;
    const { data, error } = await servicio.auth.admin.createUser({ email, password: contrasena, email_confirm: true, user_metadata: { nombre } });
    if (error) return { error: `${nombre} quedó en el equipo, pero no se pudo crear su cuenta: ${error.message}` };
    usuarioId = data.user.id;
  }
  const { error: errVincula } = await servicio.rpc("vincular_usuario_equipo", { p_equipo_id: equipoId, p_usuario_id: usuarioId });
  if (errVincula) return { error: `No se pudo vincular la cuenta: ${errVincula.message}` };
  return contrasena
    ? { contrasena, email, aviso: `Listo. Pasale a ${nombre} su mail y esta contraseña provisoria; la cambia al entrar.` }
    : { email, aviso: `Listo. ${email} ya tenía cuenta: entra con su contraseña de siempre.` };
}

export async function editarPersona(equipoId: string, nombre: string, rol: string, sede: string | null, activo: boolean): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("guardar_equipo", { p_gimnasio_id: panel.gimnasio.id, p_equipo_id: equipoId, p_nombre: nombre, p_rol: rol, p_sede_id: sede, p_activo: activo });
    revalidatePath("/panel/equipo");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}
