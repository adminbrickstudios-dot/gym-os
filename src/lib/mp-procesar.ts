import type { PagoMP } from "@/lib/mercadopago";

/**
 * VD-46A: lo que se hace con un pago de MercadoPago YA LEÍDO de su API (con el token del gimnasio), venga por
 * el webhook firmado o por la reconsulta del servidor. Nunca por el navegador. Es el único camino que acredita
 * o revierte: la base decide (acreditar_pago_mp) y deja el hecho; acá solo se registra el evento, idempotente.
 *
 * Sin "server-only" a propósito: recibe el cliente de la base y las consultas por parámetro, para probarlo sin red.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ClienteBase = {
  rpc(nombre: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
};
export type ResultadoPago = { resultado: string; ya?: boolean };

/** La clave del evento: el mismo pago en el mismo estado se procesa una vez; un estado nuevo (devuelto) es otro evento. */
export function claveEvento(pago: Pick<PagoMP, "id" | "status" | "transaction_amount_refunded">): string {
  const devuelto = Number(pago.transaction_amount_refunded ?? 0);
  return `${pago.id}:${pago.status}${devuelto > 0 ? `:dev${devuelto}` : ""}`;
}

export async function procesarPagoMP(db: ClienteBase, gimnasioId: string, pago: PagoMP, origen: unknown = {}): Promise<ResultadoPago> {
  if (!pago.external_reference || !UUID.test(pago.external_reference)) throw new Error("El pago de MercadoPago no tiene nuestra referencia");
  if (pago.currency_id && pago.currency_id !== "ARS") throw new Error(`Moneda inesperada: ${pago.currency_id}`);
  const ev = await db.rpc("registrar_evento_webhook", {
    p_origen: "mp_cobros", p_tipo: "payment", p_id_externo: claveEvento(pago), p_gimnasio_id: gimnasioId,
    p_payload: { origen, estado: pago.status, actualizado: pago.date_last_updated ?? null },
  });
  if (ev.error) throw new Error(ev.error.message);
  const evento = ev.data as { evento_id: string; procesado: boolean };
  if (evento.procesado) return { resultado: "ya_procesado", ya: true };
  try {
    const r = await db.rpc("acreditar_pago_mp", {
      p_pago_id: pago.external_reference, p_mp_pago_id: String(pago.id), p_monto: pago.transaction_amount, p_estado: pago.status,
      p_fecha: pago.date_last_updated ?? null, p_reembolsado: pago.transaction_amount_refunded ?? null,
    });
    if (r.error) throw new Error(r.error.message);
    const resultado = String(r.data);
    // Pendiente o en proceso: el evento queda abierto para el próximo aviso.
    if (resultado !== "sin_cambios") await db.rpc("cerrar_evento_webhook", { p_evento_id: evento.evento_id, p_error: null });
    return { resultado };
  } catch (e) {
    await db.rpc("cerrar_evento_webhook", { p_evento_id: evento.evento_id, p_error: (e as Error).message });
    throw e;
  }
}

export type Candidato = { pago_id: string; mp_pago_id: string | null; estado: string };
export type ResumenRevision = {
  revisados: number;
  /** Lo que cambió: acreditado, devuelto, rechazado… */
  cambios: { pago_id: string; resultado: string }[];
  /** Pagos sin pago en MercadoPago (el socio abrió el checkout y no pagó). */
  sinPago: number;
  errores: { pago_id: string; error: string }[];
};
const SIN_NOVEDAD = new Set(["ya_acreditado", "ya_procesado", "sin_cambios", "ya_devuelto", "ignorado_viejo"]);

/**
 * La reconsulta SIN cron: la base dice qué revisar (revisar_pagos_mp) y el servidor lo pregunta a MercadoPago.
 * `consultar` se inyecta (la real habla con MercadoPago; las pruebas, con un doble). Cada pago se resuelve solo:
 * uno que falla no frena a los demás.
 */
export async function revisarPagosMP(
  db: ClienteBase, gimnasioId: string,
  consultar: (c: { pagoId: string; mpPagoId: string | null }) => Promise<PagoMP | null>,
  opciones: { pagoId?: string } = {},
): Promise<ResumenRevision> {
  const lista = await db.rpc("revisar_pagos_mp", { p_gimnasio_id: gimnasioId, p_pago_id: opciones.pagoId ?? null });
  if (lista.error) throw new Error(lista.error.message);
  const candidatos = (lista.data ?? []) as Candidato[];
  const resumen: ResumenRevision = { revisados: candidatos.length, cambios: [], sinPago: 0, errores: [] };
  const uno = async (c: Candidato) => {
    try {
      const pago = await consultar({ pagoId: c.pago_id, mpPagoId: c.mp_pago_id });
      if (!pago) { resumen.sinPago++; return; }
      const r = await procesarPagoMP(db, gimnasioId, pago, "reconsulta");
      if (!SIN_NOVEDAD.has(r.resultado)) resumen.cambios.push({ pago_id: c.pago_id, resultado: r.resultado });
    } catch (e) {
      resumen.errores.push({ pago_id: c.pago_id, error: (e as Error).message });
    }
  };
  for (let i = 0; i < candidatos.length; i += 5) await Promise.all(candidatos.slice(i, i + 5).map(uno));
  return resumen;
}
