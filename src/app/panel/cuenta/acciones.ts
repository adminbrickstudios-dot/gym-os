"use server";
import { cambiarContrasenaCuenta } from "@/lib/cuenta/acciones";

/** VD-33b: con contraseña puesta pide la actual (la verifica cambiarContrasenaCuenta). */
export async function cambiarContrasena(nueva: string, actual?: string): Promise<{ error?: string }> {
  return cambiarContrasenaCuenta(nueva, actual);
}
