"use server";
import { notificarDespues } from "@/lib/push";
import { revalidatePath } from "next/cache";
import { leerMonto } from "@/lib/formato";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { achicarFoto } from "@/lib/imagenes-servidor";
import type { Billetes, CobrosMedio, ConfigCaja, EstadoTurno } from "./tipos";

export type Resumen = {
  estado?: EstadoTurno; revisado_nota?: string | null; billetes?: Billetes | null;
  turno_id: string; abierto_en: string; cerrado_en: string | null; monto_inicial: number; efectivo: number;
  ingresos: number; retiros: number; esperado: number; contado: number | null; diferencia: number | null;
  otros_medios: Record<string, number>;
};
// "1500.50" es $1.500,50, no $150.050 (AUD-6): un solo lector de montos para todo el panel.
const num = (s: string) => leerMonto(s);
const MAL = "No entiendo el monto: escribilo como 84.500 o 84500,50";

export async function abrirCaja(cajaId: string, monto: string): Promise<{ error?: string; turnoId?: string }> {
  if (String(monto).trim() && Number.isNaN(num(monto))) return { error: MAL };
  if (!(num(monto) >= 0)) return { error: "Escribí con cuánto abrís (0 si está vacía)" };
  try { const turnoId = await rpc<string>("abrir_caja", { p_caja_id: cajaId, p_monto_inicial: num(monto) }); revalidatePath("/panel/caja"); return { turnoId }; }
  catch (e) { return { error: (e as Error).message }; }
}

export async function moverCaja(turnoId: string, tipo: "ingreso" | "retiro", monto: string, motivo: string, ticket?: FormData | null): Promise<{ error?: string }> {
  if (Number.isNaN(num(monto))) return { error: MAL };
  const foto = ticket?.get("ticket");
  const conFoto = foto instanceof Blob && foto.size > 0;
  if (conFoto && (!["image/jpeg", "image/png", "image/webp"].includes(foto.type) || foto.size > 6 * 1024 * 1024)) {
    return { error: "La foto del ticket tiene que ser JPG, PNG o WEBP de hasta 6 MB." };
  }
  try {
    const id = await rpc<string>("movimiento_caja", { p_turno_id: turnoId, p_tipo: tipo, p_monto: num(monto), p_motivo: motivo });
    revalidatePath("/panel/caja");
    if (tipo === "retiro") notificarDespues("caja_retiro", id);   // PUSH-1
    // CAJ-4: la foto del ticket va después (la base arma la ruta); si falla, el retiro ya quedó anotado.
    if (conFoto) {
      // VD-47X: el ticket se guarda a 800 px como mucho y en webp (si no se puede achicar, va como vino).
      const a = await achicarFoto(new Uint8Array(await foto.arrayBuffer()), foto.type as "image/jpeg" | "image/png" | "image/webp");
      const ext = a.mime === "image/png" ? "png" : a.mime === "image/webp" ? "webp" : "jpg";
      const ruta = await rpc<string>("preparar_ticket", { p_movimiento_id: id, p_ext: ext });
      const { clienteServicio } = await import("@/lib/supabase/servicio");
      const { error } = await clienteServicio().storage.from("tickets_caja").upload(ruta, Buffer.from(a.bytes), { contentType: a.mime, upsert: false });
      if (error) return { error: `El retiro quedó anotado, pero la foto no se pudo subir: ${error.message}` };
      await rpc("confirmar_ticket", { p_movimiento_id: id, p_ruta: ruta });
    }
    return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** CAJ-4: link de 10 minutos a la foto del ticket (la base dice antes si quien la pide puede verla). */
export async function verTicket(movimientoId: string): Promise<{ url?: string; error?: string }> {
  try {
    const ruta = await rpc<string | null>("ticket_movimiento", { p_movimiento_id: movimientoId });
    if (!ruta) return { error: "Ese retiro no tiene foto del ticket" };
    const { clienteServicio } = await import("@/lib/supabase/servicio");
    const { data, error } = await clienteServicio().storage.from("tickets_caja").createSignedUrl(ruta, 600);
    if (error) return { error: `No se pudo abrir el ticket: ${error.message}` };
    return { url: data.signedUrl };
  } catch (e) { return { error: (e as Error).message }; }
}

/** Arqueo ciego: se informa lo contado y recién ahí se ve lo esperado. `billetes`: el conteo de la calculadora (opcional). */
export async function cerrarCaja(turnoId: string, contado: string, nota: string, billetes: Billetes | null = null): Promise<{ resumen?: Resumen; cobros?: CobrosMedio[] | null; error?: string }> {
  if (String(contado).trim() && Number.isNaN(num(contado))) return { error: MAL };
  if (!(num(contado) >= 0)) return { error: "Escribí cuánta plata contaste" };
  try {
    // Sin revalidar: si la página se vuelve a pintar, el turno ya cerrado desaparece
    // antes de que se vea el resultado del arqueo. La pantalla refresca al tocar "Listo".
    const resumen = await rpc<Resumen>("cerrar_caja", { p_turno_id: turnoId, p_monto_contado: num(contado), p_nota: nota || null, ...(billetes ? { p_billetes: billetes } : {}) });
    notificarDespues("caja_diferencia", turnoId);   // PUSH-1: la base decide si hubo diferencia
    // H1: lo cobrado por medio, para mostrarlo en el cierre. Si esta lectura falla el cierre ya quedó hecho: se muestra sin el detalle.
    const cobros = await rpc<CobrosMedio[]>("cobros_de_turnos", { p_turno_ids: [turnoId] }).catch(() => null);
    return { resumen, cobros };
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-9: el dueño o el encargado cuenta una caja que se cerró sola. Lo escrito queda con quién y cuándo. */
export async function contarCajaSinContar(turnoId: string, contado: string, nota: string, billetes: Billetes | null = null): Promise<{ resumen?: Resumen; error?: string }> {
  if (String(contado).trim() && Number.isNaN(num(contado))) return { error: MAL };
  if (!(num(contado) >= 0)) return { error: "Escribí cuánta plata había" };
  try {
    const resumen = await rpc<Resumen>("contar_caja_sin_contar", { p_turno_id: turnoId, p_monto_contado: num(contado), p_nota: nota || null, ...(billetes ? { p_billetes: billetes } : {}) });
    revalidatePath("/panel/caja");
    return { resumen };
  } catch (e) { return { error: (e as Error).message }; }
}

/** VD-9: dejarla sin contar pide motivo (queda escrito). */
export async function dejarCajaSinContar(turnoId: string, motivo: string): Promise<{ error?: string }> {
  if (!motivo.trim()) return { error: "Escribí por qué se deja sin contar" };
  try { await rpc("dejar_caja_sin_contar", { p_turno_id: turnoId, p_motivo: motivo }); revalidatePath("/panel/caja"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** VD-9: Configuración → Caja (solo el dueño; la base lo verifica). */
export async function guardarConfigCaja(c: ConfigCaja): Promise<{ config?: ConfigCaja; error?: string }> {
  const fondo = Number(c.fondo_fijo);
  if (!Number.isFinite(fondo) || fondo < 0) return { error: "El fondo fijo no puede ser negativo" };
  try {
    const panel = await contextoPanel();
    const config = await rpc<ConfigCaja>("guardar_config_caja", { p_gimnasio_id: panel.gimnasio.id, p_modo: c.modo, p_pedir_billetes: c.pedir_billetes,
      p_fondo_fijo: fondo, p_hora_corte: c.hora_corte, p_horas_max: Number(c.horas_max) });
    revalidatePath("/panel", "layout");
    return { config };
  } catch (e) { return { error: (e as Error).message }; }
}
