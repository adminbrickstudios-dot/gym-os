import "server-only";
import { randomInt } from "node:crypto";
import { clienteServicio } from "@/lib/supabase/servicio";

// Cuentas del equipo con la clave de servicio. Quien llama YA validó el
// permiso en la base (persona_para_dar_acceso / cuenta_para_nueva_clave /
// guardar_equipo / admin_*): acá solo se ejecuta lo que la base autorizó.

const PALABRAS = ["pesa", "disco", "barra", "banco", "soga", "remo", "salto", "plancha", "sentadilla", "kettle", "polea", "rack"];

/** Contraseña provisoria fácil de dictar por teléfono: "disco-4821-remo". */
export function contrasenaProvisoria() {
  return `${PALABRAS[randomInt(PALABRAS.length)]}-${randomInt(1000, 9999)}-${PALABRAS[randomInt(PALABRAS.length)]}`;
}

export const mailValido = (m: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m);

/**
 * Vincula una persona del equipo a la cuenta de ese mail; si no existe, la
 * crea con una contraseña provisoria y la devuelve para mostrarla UNA vez.
 */
export async function darAcceso(equipoId: string, email: string, nombre: string): Promise<{ contrasena?: string }> {
  const servicio = clienteServicio();
  const { data: existente, error: errBusca } = await servicio.rpc("usuario_por_mail", { p_email: email });
  if (errBusca) throw new Error(`No se pudo buscar la cuenta: ${errBusca.message}`);
  let usuarioId = existente as string | null;
  let contrasena: string | undefined;
  if (!usuarioId) {
    contrasena = contrasenaProvisoria();
    const { data, error } = await servicio.auth.admin.createUser({ email, password: contrasena, email_confirm: true, user_metadata: { nombre } });
    if (error) throw new Error(`No se pudo crear la cuenta: ${error.message}`);
    usuarioId = data.user.id;
  }
  const { error: errVincula } = await servicio.rpc("vincular_usuario_equipo", { p_equipo_id: equipoId, p_usuario_id: usuarioId });
  if (errVincula) throw new Error(`No se pudo vincular la cuenta: ${errVincula.message}`);
  return { contrasena };
}

/** Pone una contraseña provisoria nueva y la devuelve para mostrarla una vez. */
export async function nuevaContrasena(usuarioId: string): Promise<string> {
  const contrasena = contrasenaProvisoria();
  const { data, error } = await clienteServicio().auth.admin.updateUserById(usuarioId, { password: contrasena });
  if (error || !data.user) throw new Error(`No se pudo cambiar la contraseña: ${error?.message ?? "la cuenta no existe"}`);
  return contrasena;
}
