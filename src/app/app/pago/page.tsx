import type { Metadata } from "next";
import { intentar } from "@/lib/panel/intentar";
import { ErrorDatos, rpc } from "@/lib/panel/servidor";
import { reconsultarMercadoPago } from "@/lib/mp-reconsulta";
import { Confirmando } from "./Confirmando";

export const metadata: Metadata = { title: "Tu pago" };

/** PAY-1: la vuelta de MercadoPago. No acredita nada: muestra lo que dice la base. */
export default async function VueltaPago({ searchParams }: { searchParams: Promise<{ pago?: string }> }) {
  const pago = (await searchParams).pago ?? "";
  return intentar(async () => {
    if (!/^[0-9a-f-]{36}$/i.test(pago)) throw new ErrorDatos("Falta el pago en la dirección. Volvé al inicio y abrí el pago desde ahí.");
    // VD-46A: un pago que lleva más de 15 minutos colgado se reconsulta a MercadoPago al abrir (sin cron). Si la
    // consulta falla no se rompe la pantalla: se muestra lo que dice la base.
    const rev = await rpc<{ revisable: boolean; gimnasio_id: string }>("pago_online_revisable", { p_pago_id: pago });
    if (rev.revisable) { try { await reconsultarMercadoPago(rev.gimnasio_id, { pagoId: pago }); } catch { /* sigue con lo de la base */ } }
    const r = await rpc<{ estado: string; monto: number | null; descripcion: string | null }>("pago_online", { p_pago_id: pago });
    return <Confirmando pagoId={pago} inicial={r.estado} monto={r.monto} descripcion={r.descripcion} volver="/app" />;
  });
}
