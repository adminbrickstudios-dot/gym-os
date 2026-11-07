"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { leerMonto } from "@/lib/formato";

type Resp = { error?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nuevo = () => { revalidatePath("/panel/pt"); revalidatePath("/app/pt"); };

export type PtSocio = {
  prendido: boolean; horas_cancelar?: number; tiene_saldo?: boolean; ofrece?: boolean;
  packs?: { venta_item_id: string; nombre: string; entrenador: string | null; total: number; usadas: number; restantes: number; vence_en: string | null; vigente: boolean }[];
  sesiones?: { sesion_id: string; franja_id: string; inicio: string; fin: string; entrenador: string; sede: string; estado: string; puede_cancelar: boolean; cancelar_hasta: string; cancelada_origen: string | null; cancelada_motivo: string | null }[];
  libres?: { franja_id: string; inicio: string; fin: string; entrenador_id: string; entrenador: string; sede: string }[];
};

export async function guardarPack(productoId: string | null, nombre: string, precio: string, sesiones: number, validezDias: number | null, entrenadorId: string | null, activo: boolean): Promise<Resp> {
  const panel = await contextoPanel();
  const monto = leerMonto(precio);
  if (Number.isNaN(monto)) return { error: "No entiendo el precio: escribilo como 90.000 o 90000,50" };
  try {
    await rpc("guardar_pack_pt", {
      p_gimnasio_id: panel.gimnasio.id, p_producto_id: productoId && UUID.test(productoId) ? productoId : null, p_nombre: nombre, p_precio: monto,
      p_sesiones: sesiones, p_validez_dias: validezDias, p_entrenador_id: entrenadorId && UUID.test(entrenadorId) ? entrenadorId : null, p_activo: activo,
    });
    nuevo(); return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function guardarAntelacion(horas: number): Promise<Resp> {
  const panel = await contextoPanel();
  try { await rpc("guardar_config_pt", { p_gimnasio_id: panel.gimnasio.id, p_horas: horas }); nuevo(); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** `inicioLocal`: "2026-11-20T10:00", como lo escribe la persona; la base lo toma en la hora del gimnasio. */
export async function cargarFranjas(entrenadorId: string, sedeId: string, inicioLocal: string, minutos: number, semanas: number): Promise<Resp & { cargadas?: number }> {
  const panel = await contextoPanel();
  try {
    const cargadas = await rpc<number>("cargar_franjas_pt", { p_gimnasio_id: panel.gimnasio.id, p_sede_id: sedeId, p_entrenador_id: entrenadorId, p_inicio_local: inicioLocal, p_minutos: minutos, p_repetir_semanas: semanas });
    nuevo(); return { cargadas };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function quitarFranja(franjaId: string, motivo: string): Promise<Resp & { cancelo_sesion?: boolean }> {
  try {
    const r = await rpc<{ cancelo_sesion: boolean }>("quitar_franja_pt", { p_franja_id: franjaId, p_motivo: motivo.trim() || null });
    nuevo(); return { cancelo_sesion: r.cancelo_sesion };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function marcarSesion(sesionId: string, resultado: "dictada" | "ausente"): Promise<Resp> {
  try { await rpc("marcar_sesion_pt", { p_sesion_id: sesionId, p_resultado: resultado }); nuevo(); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

export async function cancelarSesion(sesionId: string, motivo: string): Promise<Resp> {
  try { await rpc("cancelar_sesion_pt", { p_sesion_id: sesionId, p_motivo: motivo.trim() || null }); nuevo(); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** La recepción (o el encargado, o el dueño) reserva por el socio. */
export async function reservarPorSocio(socioId: string, franjaId: string): Promise<Resp> {
  try { await rpc("reservar_sesion_pt", { p_socio_id: socioId, p_franja_id: franjaId }); nuevo(); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

export async function ptDelSocio(socioId: string): Promise<{ datos?: PtSocio; error?: string }> {
  try { return { datos: await rpc<PtSocio>("pt_socio", { p_socio_id: socioId }) }; }
  catch (e) { return { error: (e as Error).message }; }
}
