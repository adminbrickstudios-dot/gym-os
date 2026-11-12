import type { ClienteBase } from "@/lib/mp-procesar";

/**
 * N1 · Débito automático: lo que se hace con un aviso de MercadoPago sobre una suscripción, YA leído de su API con el token del gimnasio
 * (nunca lo que dice el aviso ni el navegador). Sin "server-only" a propósito: recibe el cliente de la base por parámetro para probarlo sin red.
 *
 * Un cobro se acredita UNA vez: la clave del evento es el ID de pago de MercadoPago + su estado (eventos_webhook, único por origen,
 * tipo e ID externo) y, además, la base no acepta dos veces el mismo ID de pago (cobros_debito). La base decide el resto.
 * 🔌 Los campos de la respuesta de MercadoPago están según su documentación: hay que confirmarlos con una cuenta real (docs/base/DEBITO-AUTOMATICO.md).
 */
export type CobroDebitoMP = {
  /** ID del pago de MercadoPago (único). */
  pagoId: string;
  /** ID de la suscripción (preapproval) a la que pertenece. */
  suscripcionId: string;
  monto: number;
  /** approved | rejected | cancelled | refunded | charged_back | in_process | pending */
  estado: string;
  fecha: string | null;
};
export type AdhesionMP = { suscripcionId: string; estado: string };

/** Lo que MercadoPago devuelve de un cobro de suscripción, llevado a lo que necesita la base. Tolera las dos formas conocidas. */
export function normalizarCobroDebito(raw: Record<string, unknown>): CobroDebitoMP {
  const pago = (raw.payment ?? null) as { id?: string | number; status?: string } | null;
  const pagoId = pago?.id ?? raw.id;
  const suscripcionId = raw.preapproval_id ?? raw.subscription_id;
  if (pagoId == null || !suscripcionId) throw new Error("El cobro de MercadoPago no trae el ID del pago o de la suscripción");
  const bruto = String(pago?.status ?? raw.status ?? "");
  const estado = bruto === "processed" ? "approved" : bruto === "recycling" ? "in_process" : bruto;
  const monto = Number(raw.transaction_amount ?? 0);
  if (!(monto > 0)) throw new Error("El cobro de MercadoPago no trae el monto");
  if (raw.currency_id && raw.currency_id !== "ARS") throw new Error(`Moneda inesperada: ${String(raw.currency_id)}`);
  return { pagoId: String(pagoId), suscripcionId: String(suscripcionId), monto, estado, fecha: (raw.last_modified ?? raw.date_created ?? null) as string | null };
}

export type ResultadoDebito = { resultado: string; ya?: boolean };

export async function procesarCobroDebito(db: ClienteBase, gimnasioId: string, cobro: CobroDebitoMP, origen: unknown = {}): Promise<ResultadoDebito> {
  const ev = await db.rpc("registrar_evento_webhook", {
    p_origen: "mp_cobros", p_tipo: "debito_cobro", p_id_externo: `${cobro.pagoId}:${cobro.estado}`, p_gimnasio_id: gimnasioId,
    p_payload: { origen, estado: cobro.estado, suscripcion: cobro.suscripcionId },
  });
  if (ev.error) throw new Error(ev.error.message);
  const evento = ev.data as { evento_id: string; procesado: boolean };
  if (evento.procesado) return { resultado: "ya_procesado", ya: true };
  try {
    const r = await db.rpc("acreditar_cobro_debito", {
      p_gimnasio_id: gimnasioId, p_mp_suscripcion_id: cobro.suscripcionId, p_mp_pago_id: cobro.pagoId, p_monto: cobro.monto, p_estado: cobro.estado, p_fecha: cobro.fecha,
    });
    if (r.error) throw new Error(r.error.message);
    const resultado = String(r.data);
    // Pendiente, en proceso o función apagada: el evento queda abierto, así el mismo aviso se acredita cuando corresponda (nunca se pierde un cobro).
    if (resultado !== "sin_cambios" && resultado !== "funcion_apagada") await db.rpc("cerrar_evento_webhook", { p_evento_id: evento.evento_id, p_error: null });
    return { resultado };
  } catch (e) {
    await db.rpc("cerrar_evento_webhook", { p_evento_id: evento.evento_id, p_error: (e as Error).message });
    throw e;
  }
}

export async function procesarAdhesionDebito(db: ClienteBase, gimnasioId: string, a: AdhesionMP, origen: unknown = {}): Promise<ResultadoDebito> {
  const ev = await db.rpc("registrar_evento_webhook", {
    p_origen: "mp_cobros", p_tipo: "debito_adhesion", p_id_externo: `${a.suscripcionId}:${a.estado}`, p_gimnasio_id: gimnasioId,
    p_payload: { origen, estado: a.estado },
  });
  if (ev.error) throw new Error(ev.error.message);
  const evento = ev.data as { evento_id: string; procesado: boolean };
  if (evento.procesado) return { resultado: "ya_procesado", ya: true };
  try {
    const r = await db.rpc("actualizar_adhesion_debito", { p_gimnasio_id: gimnasioId, p_mp_suscripcion_id: a.suscripcionId, p_estado: a.estado });
    if (r.error) throw new Error(r.error.message);
    const resultado = String(r.data);
    if (resultado !== "funcion_apagada") await db.rpc("cerrar_evento_webhook", { p_evento_id: evento.evento_id, p_error: null });
    return { resultado };
  } catch (e) {
    await db.rpc("cerrar_evento_webhook", { p_evento_id: evento.evento_id, p_error: (e as Error).message });
    throw e;
  }
}
