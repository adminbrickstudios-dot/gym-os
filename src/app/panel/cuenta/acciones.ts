"use server";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export async function cambiarContrasena(nueva: string): Promise<{ error?: string }> {
  if (nueva.length < 8) return { error: "Tiene que tener al menos 8 caracteres" };
  const { error } = await (await crearClienteServidor()).auth.updateUser({ password: nueva });
  return error ? { error: `No se pudo cambiar: ${error.message}` } : {};
}
