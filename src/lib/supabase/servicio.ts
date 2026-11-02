import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requerir, supabaseUrl } from "@/lib/entorno";

/**
 * Cliente con la clave de servicio: SALTEA RLS. Solo en el servidor y solo
 * para lo que el navegador no puede hacer (firmar un link de un archivo
 * privado, invitar por mail). Quien lo usa ya validó el permiso antes.
 */
export function clienteServicio() {
  const clave = requerir("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  return createClient(supabaseUrl(), clave, { auth: { persistSession: false, autoRefreshToken: false } });
}
