import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * PAY-1: lo mínimo de la API de MercadoPago (Checkout Pro y pagos). La base
 * de la API se puede cambiar (MP_API_URL) para probar con el simulador local
 * (scripts/local/mp-simulado.mjs); en producción es la de MercadoPago.
 */
const API = () => (process.env.MP_API_URL ?? "https://api.mercadopago.com").replace(/\/$/, "");

export type Preferencia = { id: string; init_point: string; sandbox_init_point?: string };
export type PagoMP = { id: number | string; status: string; external_reference: string | null; transaction_amount: number; currency_id: string };

async function llamar<T>(token: string, ruta: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API()}${ruta}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const cuerpo = await r.text();
  if (!r.ok) throw new Error(`MercadoPago respondió ${r.status} en ${ruta}: ${cuerpo.slice(0, 200)}`);
  return JSON.parse(cuerpo) as T;
}

export function crearPreferencia(token: string, p: { pagoId: string; titulo: string; monto: number; volver: string; avisar: string; mail?: string | null }) {
  return llamar<Preferencia>(token, "/checkout/preferences", {
    method: "POST",
    headers: { "x-idempotency-key": p.pagoId },
    body: JSON.stringify({
      items: [{ id: p.pagoId, title: p.titulo, quantity: 1, unit_price: Number(p.monto), currency_id: "ARS" }],
      external_reference: p.pagoId,
      notification_url: p.avisar,
      back_urls: { success: p.volver, pending: p.volver, failure: p.volver },
      auto_return: "approved",
      ...(p.mail ? { payer: { email: p.mail } } : {}),
    }),
  });
}

export const leerPago = (token: string, id: string) => llamar<PagoMP>(token, `/v1/payments/${encodeURIComponent(id)}`);

/**
 * Firma del webhook (x-signature "ts=…,v1=…"): HMAC-SHA256 de
 * "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" con la clave secreta del
 * webhook. data.id va en minúsculas si es alfanumérico (así lo firma MP).
 */
export function firmaValida(secreto: string, xSignature: string | null, xRequestId: string | null, dataId: string | null): boolean {
  if (!secreto || !xSignature || !dataId) return false;
  const partes = Object.fromEntries(xSignature.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  if (!partes.ts || !partes.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifiesto = `id:${id};${xRequestId ? `request-id:${xRequestId};` : ""}ts:${partes.ts};`;
  const esperada = createHmac("sha256", secreto).update(manifiesto).digest("hex");
  const a = Buffer.from(esperada, "hex"); const b = Buffer.from(partes.v1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Para el simulador y las pruebas: firma como lo hace MercadoPago. */
export function firmar(secreto: string, dataId: string, xRequestId: string, ts = String(Math.floor(Date.now() / 1000))) {
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  return `ts=${ts},v1=${createHmac("sha256", secreto).update(`id:${id};request-id:${xRequestId};ts:${ts};`).digest("hex")}`;
}
