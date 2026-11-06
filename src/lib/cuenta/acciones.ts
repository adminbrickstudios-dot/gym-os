"use server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { MiSeguridad } from "./dispositivo";

/**
 * VD-33b: cambiar la contraseña de la cuenta con la sesión abierta (equipo, dueño, socio).
 * Si ya tiene contraseña, pide la actual y la verifica con un cliente aparte (que no toca las
 * cookies y cierra enseguida la sesión que abre). Si entró siempre con código (no tiene), alcanza con la nueva.
 */
export async function cambiarContrasenaCuenta(nueva: string, actual?: string): Promise<{ error?: string }> {
  if (nueva.length < 8) return { error: "La contraseña nueva tiene que tener 8 caracteres o más" };
  const supabase = await crearClienteServidor();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: "Tu sesión se venció. Entrá de nuevo." };
  const { data: seg, error: errSeg } = await supabase.rpc("mi_seguridad");
  if (errSeg) return { error: `No pudimos revisar tu cuenta: ${errSeg.message}` };
  if ((seg as MiSeguridad).tiene_contrasena) {
    if (!actual) return { error: "Escribí tu contraseña actual" };
    const identidad = u.user.email ? { email: u.user.email } : u.user.phone ? { phone: u.user.phone.startsWith("+") ? u.user.phone : `+${u.user.phone}` } : null;
    if (!identidad) return { error: "Tu cuenta no tiene mail ni celular para verificar la contraseña." };
    const aparte = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { error: errActual } = await aparte.auth.signInWithPassword({ ...identidad, password: actual });
    if (errActual) {
      return { error: (errActual.status ?? 400) >= 500 ? "No pudimos verificar tu contraseña ahora. Probá de nuevo en un rato." : "La contraseña actual no es correcta" };
    }
    await aparte.auth.signOut({ scope: "local" }).catch(() => {});
  }
  const { error } = await supabase.auth.updateUser({ password: nueva });
  return error ? { error: `No se pudo cambiar: ${error.message}` } : {};
}

/** VD-33b: cierra todas las sesiones de la cuenta menos esta (el celular perdido, la compu de otro). */
export async function cerrarOtrasSesiones(): Promise<{ error?: string }> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  return error ? { error: `No se pudieron cerrar: ${error.message}` } : {};
}
