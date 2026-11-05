// PAY-1: el aviso de MercadoPago. Es la única forma en que un pago online se
// acredita (nunca el navegador que vuelve). Firmado con la clave del webhook
// del gimnasio e idempotente por ID externo (eventos_webhook). El estado y el
// monto se leen de la API de MercadoPago con el token del gimnasio, no del aviso.
import { leerPago, firmaValida } from "@/lib/mercadopago";
import { clienteServicio } from "@/lib/supabase/servicio";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const responder = (status: number, cuerpo: Record<string, unknown>) => Response.json(cuerpo, { status });

export async function POST(req: Request) {
  const u = new URL(req.url);
  const gimnasio = u.searchParams.get("g") ?? "";
  if (!UUID.test(gimnasio)) return responder(400, { error: "Falta el gimnasio (?g=)" });
  let cuerpo: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try { cuerpo = await req.json(); } catch { /* MP a veces avisa solo por la URL */ }
  const tipo = u.searchParams.get("type") ?? cuerpo.type ?? (cuerpo.action?.split(".")[0] ?? "");
  const dataId = u.searchParams.get("data.id") ?? (cuerpo.data?.id != null ? String(cuerpo.data.id) : null);

  const db = clienteServicio();
  const { data: cred, error: e1 } = await db.rpc("credenciales_mp", { p_gimnasio_id: gimnasio });
  if (e1) return responder(500, { error: e1.message });
  const c = cred as { token: string; webhook_secreto: string } | null;
  if (!c?.token) return responder(404, { error: "Ese gimnasio no tiene MercadoPago conectado" });
  if (!firmaValida(c.webhook_secreto, req.headers.get("x-signature"), req.headers.get("x-request-id"), dataId)) {
    return responder(401, { error: "Firma inválida" });
  }
  if (tipo !== "payment" || !dataId) return responder(200, { ignorado: tipo || "sin tipo" });

  const { data: ev, error: e2 } = await db.rpc("registrar_evento_webhook", { p_origen: "mp_cobros", p_tipo: "payment", p_id_externo: dataId, p_gimnasio_id: gimnasio, p_payload: cuerpo });
  if (e2) return responder(500, { error: e2.message });
  const evento = ev as { evento_id: string; procesado: boolean };
  if (evento.procesado) return responder(200, { ya: true });

  try {
    const pago = await leerPago(c.token, dataId);
    if (!pago.external_reference || !UUID.test(pago.external_reference)) throw new Error("El pago de MercadoPago no tiene nuestra referencia");
    if (pago.currency_id && pago.currency_id !== "ARS") throw new Error(`Moneda inesperada: ${pago.currency_id}`);
    const { data: r, error } = await db.rpc("acreditar_pago_mp", { p_pago_id: pago.external_reference, p_mp_pago_id: String(pago.id), p_monto: pago.transaction_amount, p_estado: pago.status });
    if (error) throw new Error(error.message);
    // Pendiente o en proceso: el evento queda abierto para el próximo aviso.
    if (r !== "sin_cambios") await db.rpc("cerrar_evento_webhook", { p_evento_id: evento.evento_id, p_error: null });
    return responder(200, { resultado: r });
  } catch (e) {
    await db.rpc("cerrar_evento_webhook", { p_evento_id: evento.evento_id, p_error: (e as Error).message });
    // 500: MercadoPago vuelve a avisar más tarde.
    return responder(500, { error: (e as Error).message });
  }
}
