"use server";
import { notificarDespues } from "@/lib/push";
import { headers } from "next/headers";
import { crearPreferencia } from "@/lib/mercadopago";
import { clienteServicio } from "@/lib/supabase/servicio";
import { revalidatePath } from "next/cache";
import { rpc } from "@/lib/panel/servidor";

const r = async (f: () => Promise<unknown>) => {
  try { await f(); revalidatePath("/app"); revalidatePath("/app/clases"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
};
export const reservarClase = async (claseId: string, socioId: string) => r(() => rpc("reservar", { p_clase_id: claseId, p_socio_id: socioId }));
export const cancelarReserva = async (reservaId: string) => r(() => rpc("cancelar_reserva", { p_reserva_id: reservaId }));
/** El comprobante ya está subido al bucket (desde el navegador, a la carpeta del socio): acá se informa el pago. */
export const informarPago = async (socioId: string, path: string) => r(async () => {
  const x = await rpc<{ pago_id: string }>("informar_transferencia", { p_socio_id: socioId, p_comprobante_path: path, p_cuotas: 1 });
  notificarDespues("comprobante", x?.pago_id);   // PUSH-1: a quien lo revisa
});

/** El QR de entrada (ENT-2): lo arma y lo firma la base; cambia cada 30 segundos. */
export async function codigoQR(gimnasioId: string, socioId: string): Promise<{ codigo?: string; vence_en?: string; error?: string }> {
  try { return await rpc<{ codigo: string; vence_en: string }>("mi_qr", { p_gimnasio_id: gimnasioId, p_socio_id: socioId }); }
  catch (e) { return { error: (e as Error).message }; }
}

/** El socio escaneó el QR de la tablet de la entrada (ENT-6): la base valida el código y anota la entrada. */
export async function escanearEntrada(gimnasioId: string, socioId: string, codigo: string): Promise<{ resultado?: string; color?: string; texto?: string; error?: string }> {
  try {
    const r = await rpc<{ resultado: string; color: string; texto: string }>("entrar_por_qr_pared", { p_gimnasio_id: gimnasioId, p_socio_id: socioId, p_codigo: codigo });
    revalidatePath("/app");
    return r;
  } catch (e) { return { error: (e as Error).message }; }
}

/** Invitar a alguien hoy (INV-1): la recepción confirma cuando llega. */
export async function invitarHoy(gimnasioId: string, socioId: string, nombre: string, dni: string): Promise<{ error?: string }> {
  try { await rpc("invitar", { p_gimnasio_id: gimnasioId, p_socio_id: socioId, p_nombre: nombre, p_dni: dni }); revalidatePath("/app"); return {}; }
  catch (e) { return { error: (e as Error).message }; }
}

/**
 * PAY-1: la base arma la venta y el pago pendiente (al precio de MercadoPago);
 * acá se crea el checkout con el token del gimnasio (de Vault, con la clave de
 * servicio) y se devuelve a dónde ir. El aviso de MercadoPago es el que acredita.
 */
export async function pagarConMercadoPago(socioId: string): Promise<{ url?: string; error?: string }> {
  try {
    const p = await rpc<{ pago_id: string; gimnasio_id: string; monto: number; descripcion: string }>("iniciar_pago_online", { p_socio_id: socioId });
    const { data, error } = await clienteServicio().rpc("credenciales_mp", { p_gimnasio_id: p.gimnasio_id });
    if (error) return { error: error.message };
    const c = data as { token: string; modo: string } | null;
    if (!c?.token) return { error: "El gimnasio no tiene MercadoPago conectado" };
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.|[^.]+\.localhost)/.test(host) ? "http" : "https");
    const origen = `${proto}://${host}`;
    const pref = await crearPreferencia(c.token, {
      pagoId: p.pago_id, titulo: p.descripcion, monto: Number(p.monto),
      volver: `${origen}/app/pago?pago=${p.pago_id}`,
      avisar: `${origen}/api/webhooks/mercadopago?g=${p.gimnasio_id}`,
    });
    return { url: c.modo === "prueba" && pref.sandbox_init_point ? pref.sandbox_init_point : pref.init_point };
  } catch (e) { return { error: (e as Error).message }; }
}

/** "Confirmando tu pago…": cómo va (lo pregunta la pantalla cada pocos segundos). */
export async function estadoPagoOnline(pagoId: string): Promise<{ estado?: string; motivo?: string | null; error?: string }> {
  try {
    const r = await rpc<{ estado: string; rechazado_motivo: string | null }>("pago_online", { p_pago_id: pagoId });
    if (r.estado !== "pendiente") revalidatePath("/app");
    return { estado: r.estado, motivo: r.rechazado_motivo };
  } catch (e) { return { error: (e as Error).message }; }
}

/** APP-8: el socio pide una pausa (la aprueba el gimnasio) o la baja (la da el gimnasio). */
export const pedirPausaSocio = async (socioId: string, desde: string, hasta: string, categoria: string, nota: string) =>
  r(async () => { await rpc("pedir_pausa_socio", { p_socio_id: socioId, p_desde: desde, p_hasta: hasta, p_categoria: categoria, p_nota: nota || null }); revalidatePath("/app/cuenta"); });
export const pedirBajaSocio = async (socioId: string, motivo: string, nota: string) =>
  r(async () => { await rpc("pedir_baja_socio", { p_socio_id: socioId, p_motivo: motivo, p_nota: nota || null }); revalidatePath("/app/cuenta"); });
