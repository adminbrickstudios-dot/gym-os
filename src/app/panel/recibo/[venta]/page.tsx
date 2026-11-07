import type { Metadata } from "next";
import Link from "next/link";
import { Recibo } from "@/components/Recibo";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, ErrorDatos, exigirRol, rpc } from "@/lib/panel/servidor";
import type { ReciboDatos } from "@/lib/recibo";

export const metadata: Metadata = { title: "Recibo" };

/** VD-56: el recibo de un pago, para imprimir, guardar como PDF o mandar por WhatsApp. La base arma todo y decide quién lo ve. */
export default async function PaginaRecibo({ params }: { params: Promise<{ venta: string }> }) {
  const { venta } = await params;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    if (!/^[0-9a-f-]{36}$/i.test(venta)) throw new ErrorDatos("Ese recibo no existe.", "22023", 404);
    const r = await rpc<ReciboDatos>("recibo_venta", { p_venta_id: venta }, { lectura: true });
    return <Recibo r={r} volver={<Link href="/panel" className="texto-suave">← Volver al panel</Link>} />;
  });
}
