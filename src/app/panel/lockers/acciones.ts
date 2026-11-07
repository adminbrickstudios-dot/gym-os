"use server";
import { revalidatePath } from "next/cache";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { leerMonto } from "@/lib/formato";

type Resp = { error?: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const nuevo = () => { revalidatePath("/panel/lockers"); revalidatePath("/panel"); };

export async function crearLocker(sedeId: string, numero: string, ubicacion: string): Promise<Resp> {
  const panel = await contextoPanel();
  try {
    await rpc("crear_locker", { p_gimnasio_id: panel.gimnasio.id, p_sede_id: sedeId, p_numero: numero, p_ubicacion: ubicacion.trim() || null });
    nuevo(); return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function crearLockersSerie(sedeId: string, desde: number, hasta: number, prefijo: string, ubicacion: string): Promise<Resp & { creados?: number }> {
  const panel = await contextoPanel();
  try {
    const creados = await rpc<number>("crear_lockers_serie", { p_gimnasio_id: panel.gimnasio.id, p_sede_id: sedeId, p_desde: desde, p_hasta: hasta, p_prefijo: prefijo.trim() || null, p_ubicacion: ubicacion.trim() || null });
    nuevo(); return { creados };
  } catch (e) { return { error: (e as Error).message }; }
}

export async function bajaLocker(lockerId: string, activo: boolean): Promise<Resp> {
  try { await rpc("dar_de_baja_locker", { p_locker_id: lockerId, p_activo: activo }); nuevo(); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/** El precio se escribe como se escribe en todo el panel: 4.500 o 4500,50. */
export async function guardarTarifa(productoId: string | null, nombre: string, precio: string, meses: number, activo: boolean): Promise<Resp> {
  const panel = await contextoPanel();
  const monto = leerMonto(precio);
  if (Number.isNaN(monto)) return { error: "No entiendo el precio: escribilo como 4.500 o 4500,50" };
  try {
    await rpc("guardar_tarifa_locker", { p_gimnasio_id: panel.gimnasio.id, p_producto_id: productoId && UUID.test(productoId) ? productoId : null, p_nombre: nombre, p_precio: monto, p_meses: meses, p_activo: activo });
    nuevo(); return {};
  } catch (e) { return { error: (e as Error).message }; }
}

/** Con un cobro (ventaItemId) o, sólo dueño/encargado, una cortesía con motivo y meses. */
export async function alquilarLocker(lockerId: string, socioId: string, ventaItemId: string | null, meses: number | null, motivo: string | null): Promise<Resp> {
  try {
    await rpc("alquilar_locker", { p_locker_id: lockerId, p_socio_id: socioId, p_venta_item_id: ventaItemId, p_meses: meses, p_motivo: motivo });
    nuevo(); return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function renovarLocker(alquilerId: string, ventaItemId: string | null, meses: number | null, motivo: string | null): Promise<Resp> {
  try {
    await rpc("renovar_alquiler_locker", { p_alquiler_id: alquilerId, p_venta_item_id: ventaItemId, p_meses: meses, p_motivo: motivo });
    nuevo(); return {};
  } catch (e) { return { error: (e as Error).message }; }
}

export async function liberarLocker(lockerId: string, motivo: string): Promise<Resp> {
  try { await rpc("liberar_locker", { p_locker_id: lockerId, p_motivo: motivo }); nuevo(); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}
