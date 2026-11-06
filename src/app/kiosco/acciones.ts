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

const cliente = () => createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
const token = async () => (await cookies()).get(COOKIE_TABLET)?.value ?? "";

/** El QR que muestra la tablet para que el socio lo escanee (ENT-6). Lo firma la base. */
export async function qrDeLaTablet(): Promise<{ codigo?: string; vence_en?: string; error?: string }> {
  const { data, error } = await cliente().rpc("kiosco_qr", { p_token: await token() });
  return error ? { error: error.message } : data;
}

/** Quién entró por esta tablet escaneando su QR, desde un momento. */
export async function ultimoDeLaTablet(desde: string): Promise<Resultado | null> {
  const { data, error } = await cliente().rpc("kiosco_ultimo", { p_token: await token(), p_desde: desde });
  return error || !data ? null : (data as Resultado & { momento: string });
}

/** COM-7: los que suelen venir a esta hora (si el dueño lo prendió). */
export async function habitualesDeLaTablet(): Promise<{ socio_id: string; nombre: string }[]> {
  const { data, error } = await cliente().rpc("kiosco_habituales", { p_token: await token() });
  return error || !data ? [] : data;
}

/** VD-46M: ¿la puerta está en emergencia? (la tablet muestra el cartel rojo; lo decide la base con el token de la tablet). */
export async function emergenciaDeLaTablet(): Promise<{ activa: boolean; vence_en: string | null } | null> {
  const { data, error } = await cliente().rpc("kiosco_emergencia", { p_token: await token() });
  return error || !data ? null : (data as { activa: boolean; vence_en: string | null });   // sin respuesta: la tablet deja el cartel como estaba
}

/** Tocó su nombre: entra con los últimos 3 números del DNI (lo decide la base, igual que con el DNI entero). */
export async function entrarHabitual(socioId: string, dniFin: string): Promise<Resultado> {
  const t = await token();
  if (!t) return { error: "Esta tablet no está autorizada. El dueño la autoriza desde Configuración → Reglas." };
  const { data, error } = await cliente().rpc("kiosco_entrar_habitual", { p_token: t, p_socio_id: socioId, p_dni_fin: dniFin });
  return error ? { error: error.message } : (data as Resultado);
}
