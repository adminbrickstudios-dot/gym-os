"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";

/** VD-42: anota el dispositivo desde el que entra alguien del equipo (uno nuevo avisa al dueño). */
export async function registrarSesionEquipo(): Promise<void> {
  try {
    const panel = await contextoPanel();
    await rpc("registrar_sesion_equipo", { p_gimnasio_id: panel.gimnasio.id });
  } catch (e) {
    // No frena a nadie de trabajar, pero queda en el registro del servidor: una alerta que no se genera no es invisible.
    console.error("registrar_sesion_equipo:", (e as Error).message);
  }
}

/** VD-42: el dueño marca como vistas las alertas de seguridad. */
export async function marcarAlertasVistas(): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("marcar_alertas_vistas", { p_gimnasio_id: panel.gimnasio.id });
    revalidatePath("/panel");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-42: "Dar de baja" a alguien del equipo (cuenta, PIN, turno y sesiones; el historial queda). Lo valida la base. */
export async function darDeBajaPersona(equipoId: string, motivo?: string): Promise<{ error?: string; aviso?: string }> {
  const panel = await contextoPanel();
  try {
    const r = await rpc<{ nombre: string; sesiones_cerradas: number; turnos_cerrados: number; pin_borrado: boolean }>(
      "dar_de_baja_equipo", { p_gimnasio_id: panel.gimnasio.id, p_equipo_id: equipoId, p_motivo: motivo?.trim() || null });
    revalidatePath("/panel/equipo");
    const partes = [
      r.sesiones_cerradas > 0 ? (r.sesiones_cerradas === 1 ? "se cerró su sesión" : `se cerraron sus ${r.sesiones_cerradas} sesiones`) : null,
      r.pin_borrado ? "se borró su PIN" : null,
      r.turnos_cerrados > 0 ? "su turno de caja quedó cerrado sin contar (lo revisás en Caja)" : null,
    ].filter(Boolean);
    return { aviso: `${r.nombre} ya no entra al sistema${partes.length ? `: ${partes.join(", ")}` : ""}. Su historial queda.` };
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-43: 10 socios de ejemplo para probar (solo el dueño; lo valida la base). */
export async function cargarEjemplos(): Promise<{ error?: string }> {
  const panel = await contextoPanel();
  try {
    await rpc("cargar_socios_ejemplo", { p_gimnasio_id: panel.gimnasio.id });
    revalidatePath("/panel", "layout");
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-43: borra los socios de ejemplo y solo ellos. */
export async function borrarEjemplos(): Promise<{ error?: string; aviso?: string }> {
  const panel = await contextoPanel();
  try {
    const r = await rpc<{ borrados: number; quedaron: number }>("borrar_socios_ejemplo", { p_gimnasio_id: panel.gimnasio.id });
    revalidatePath("/panel", "layout");
    return { aviso: r.quedaron > 0 ? `Borramos ${r.borrados}. ${r.quedaron === 1 ? "Uno se quedó" : `${r.quedaron} se quedaron`} porque ya tiene movimientos (una entrada o un cobro).` : `Borramos los ${r.borrados} de ejemplo.` };
  } catch (e) { return { error: (e as Error).message }; }
}
