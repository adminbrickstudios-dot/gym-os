import "server-only";
import { randomInt } from "node:crypto";
import { clienteServicio } from "@/lib/supabase/servicio";
import { traducirErrorSupabase } from "@/lib/admin/errores-supabase";

// Cuentas del equipo con la clave de servicio. Quien llama YA validó el
// permiso en la base (persona_para_dar_acceso / cuenta_para_nueva_clave /
// guardar_equipo / admin_*): acá solo se ejecuta lo que la base autorizó.

const PALABRAS = ["pesa", "disco", "barra", "banco", "soga", "remo", "salto", "plancha", "sentadilla", "kettle", "polea", "rack"];

/** Contraseña provisoria fácil de dictar por teléfono: "disco-4821-remo". */
export function contrasenaProvisoria() {
  return `${PALABRAS[randomInt(PALABRAS.length)]}-${randomInt(1000, 9999)}-${PALABRAS[randomInt(PALABRAS.length)]}`;
}

/** D42: quien crea la cuenta puede escribir la contraseña. Vacía = se genera una provisoria. */
export function contrasenaElegida(f: FormData): string | undefined {
  const c = String(f.get("contrasena_elegida") ?? "").trim();
  if (!c) return undefined;
  if (c.length < 8) throw new Error("La contraseña tiene que tener 8 letras o más");
  return c;
}

export const mailValido = (m: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m);

/**
 * Vincula una persona del equipo a la cuenta de ese mail; si no existe, la
 * crea con una contraseña provisoria y la devuelve para mostrarla UNA vez.
 */
export async function darAcceso(equipoId: string, email: string, nombre: string, elegida?: string): Promise<{ contrasena?: string }> {
  // U1: un error de la clave de servicio nunca sale como "Invalid API key": sale en palabras y con qué hacer.
  try { return await darAccesoSinTraducir(equipoId, email, nombre, elegida); }
  catch (e) { throw new Error(traducirErrorSupabase((e as Error).message)); }
}

async function darAccesoSinTraducir(equipoId: string, email: string, nombre: string, elegida?: string): Promise<{ contrasena?: string }> {
  const servicio = clienteServicio();
  const { data: existente, error: errBusca } = await servicio.rpc("usuario_por_mail", { p_email: email });
  if (errBusca) throw new Error(`No se pudo buscar la cuenta: ${errBusca.message}`);
  let usuarioId = existente as string | null;
  let contrasena: string | undefined;
  if (!usuarioId) {
    contrasena = elegida ?? contrasenaProvisoria();
    const { data, error } = await servicio.auth.admin.createUser({ email, password: contrasena, email_confirm: true, user_metadata: { nombre } });
    if (error) throw new Error(`No se pudo crear la cuenta: ${error.message}`);
    usuarioId = data.user.id;
  }
  const { error: errVincula } = await servicio.rpc("vincular_usuario_equipo", { p_equipo_id: equipoId, p_usuario_id: usuarioId });
  if (errVincula) throw new Error(`No se pudo vincular la cuenta: ${errVincula.message}`);
  return { contrasena };
}

/** Pone una contraseña provisoria nueva y la devuelve para mostrarla una vez. */
export async function nuevaContrasena(usuarioId: string, elegida?: string): Promise<string> {
  const contrasena = elegida ?? contrasenaProvisoria();
  try {
    const { data, error } = await clienteServicio().auth.admin.updateUserById(usuarioId, { password: contrasena });
    if (error || !data.user) throw new Error(`No se pudo cambiar la contraseña: ${error?.message ?? "la cuenta no existe"}`);
  } catch (e) { throw new Error(traducirErrorSupabase((e as Error).message)); }
  return contrasena;
}
