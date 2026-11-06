import "server-only";
import { consultarPagoMP, type PagoMP } from "@/lib/mercadopago";
import { revisarPagosMP, type ResumenRevision } from "@/lib/mp-procesar";
import { clienteServicio } from "@/lib/supabase/servicio";

export type ConsultaMP = (token: string, p: { pagoId: string; mpPagoId: string | null }) => Promise<PagoMP | null>;

/**
 * VD-46A: reconsulta a MercadoPago (con el token del gimnasio) lo que la base marca como dudoso: pagos pendientes de
 * más de 15 minutos y aprobados de los últimos 30 días. SIN cron: lo dispara una persona (el dueño, o el socio al
 * abrir su pantalla de pago). Quien llama YA comprobó el permiso; esto usa la clave de servicio, que es lo único que
 * puede acreditar o revertir. `consultar` se puede reemplazar en las pruebas.
 * Devuelve null si el gimnasio no tiene MercadoPago conectado.
 */
export async function reconsultarMercadoPago(gimnasioId: string, opciones: { pagoId?: string; consultar?: ConsultaMP } = {}): Promise<ResumenRevision | null> {
  const db = clienteServicio();
  const { data, error } = await db.rpc("credenciales_mp", { p_gimnasio_id: gimnasioId });
  if (error) throw new Error(error.message);
  const token = (data as { token?: string } | null)?.token;
  if (!token) return null;
  const consultar = opciones.consultar ?? consultarPagoMP;
  return revisarPagosMP(db, gimnasioId, (c) => consultar(token, c), { pagoId: opciones.pagoId });
}
