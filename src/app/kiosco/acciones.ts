"use server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";
import { COOKIE_TABLET } from "./cookie";

export type Resultado = { nombre?: string; resultado?: string; repetido?: boolean; color?: string; texto?: string; error?: string };

/** La tablet no tiene sesión: la autoriza su token (en una cookie que no lee el navegador). Lo decide la base. */
export async function entrarEnKiosco(codigo: string): Promise<Resultado> {
  const token = (await cookies()).get(COOKIE_TABLET)?.value;
  if (!token) return { error: "Esta tablet no está autorizada. El dueño la autoriza desde Configuración → Reglas." };
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("kiosco_entrar", { p_token: token, p_codigo: codigo });
  if (error) return { error: error.message };
  return data as Resultado;
}
