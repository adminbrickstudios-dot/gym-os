"use server";
import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnon, supabaseUrl } from "@/lib/entorno";
import { COOKIE_TV } from "./cookie";

export type ClaseTv = { clase_id: string; actividad: string; emoji: string | null; inicio: string; fin: string; profe: string | null; cupo: number | null;
  wod?: string | null; anotados: { nombre: string; presente: boolean }[] };
export type EstadoTv = { tv: string; modo?: "clases" | "entradas"; gimnasio: string; sede: string; zona: string; ocupacion?: number; ahora: ClaseTv | null; proxima: ClaseTv | null; entradas?: { nombre: string; momento: string }[] };

/** Lo que muestra la TV ahora. Sin sesión: la autoriza su token, y lo decide la base. */
export async function estadoTv(): Promise<{ estado?: EstadoTv; error?: string }> {
  const token = (await cookies()).get(COOKIE_TV)?.value;
  if (!token) return { error: "Esta TV no está autorizada. El dueño la autoriza desde Clases → TV de la sala." };
  const supabase = createClient(supabaseUrl(), supabaseAnon(), { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("tv_estado", { p_token: token });
  return error ? { error: error.message } : { estado: data as EstadoTv };
}
