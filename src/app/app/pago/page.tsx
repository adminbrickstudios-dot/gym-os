import type { Metadata } from "next";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";
import { Confirmando } from "./Confirmando";

export const metadata: Metadata = { title: "Tu pago" };

/** PAY-1: la vuelta de MercadoPago. No acredita nada: muestra lo que dice la base. */
export default async function VueltaPago({ searchParams }: { searchParams: Promise<{ pago?: string }> }) {
  const pago = (await searchParams).pago ?? "";
  return intentar(async () => {
    if (!/^[0-9a-f-]{36}$/i.test(pago)) throw new Error("Falta el pago en la dirección");
    const r = await rpc<{ estado: string }>("pago_online", { p_pago_id: pago });
    return <Confirmando pagoId={pago} inicial={r.estado} volver="/app" />;
  });
}
