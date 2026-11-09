"use server";
import { rpc } from "@/lib/panel/servidor";
import { gimnasioActual } from "@/lib/supabase/servidor";

/** SA-1: una pantalla que falló queda anotada para el tablero del super admin (errores de 24 h). Nunca rompe ni frena a quien la ve. */
export async function anotarErrorPantalla(pantalla: string, mensaje: string): Promise<void> {
  try {
    let gimnasioId: string | null = null;
    try { gimnasioId = (await gimnasioActual()).id; } catch { /* pantalla de la plataforma */ }
    await rpc("registrar_error_app", { p_gimnasio_id: gimnasioId, p_pantalla: pantalla, p_mensaje: mensaje });
  } catch { /* sin sesión, sin permiso o tope por hora: no se dice nada */ }
}
