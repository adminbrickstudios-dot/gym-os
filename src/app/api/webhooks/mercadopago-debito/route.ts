// N1: el aviso de MercadoPago sobre el débito automático (suscripciones). Igual que el de los pagos online: es la única forma en que
// un cobro automático se acredita (nunca el navegador), va firmado con la clave del webhook del gimnasio y es idempotente por ID externo
// (eventos_webhook + cobros_debito). El estado y el monto salen de la API de MercadoPago con el token del gimnasio, no del aviso.
// Con la función apagada para ese gimnasio, la base no hace nada y se responde 200 (MercadoPago no reintenta).
import { firmaValida } from "@/lib/mercadopago";
import { leerAdhesionDebito, leerCobroDebito } from "@/lib/mp-debito";
import { procesarAdhesionDebito, procesarCobroDebito } from "@/lib/mp-debito-procesar";
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
  if (!dataId || (tipo !== "subscription_authorized_payment" && tipo !== "subscription_preapproval")) return responder(200, { ignorado: tipo || "sin tipo" });

  try {
    if (tipo === "subscription_authorized_payment") {
      const cobro = await leerCobroDebito(c.token, dataId);
      const r = await procesarCobroDebito(db, gimnasio, cobro, { tipo, dataId });
      return r.ya ? responder(200, { ya: true }) : responder(200, { resultado: r.resultado });
    }
    const adhesion = await leerAdhesionDebito(c.token, dataId);
    const r = await procesarAdhesionDebito(db, gimnasio, adhesion, { tipo, dataId });
    return r.ya ? responder(200, { ya: true }) : responder(200, { resultado: r.resultado });
  } catch (e) {
    // 500: MercadoPago vuelve a avisar más tarde (el evento queda anotado con el error).
    return responder(500, { error: (e as Error).message });
  }
}
