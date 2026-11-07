import type { Metadata } from "next";
import Link from "next/link";
import { Recibo } from "@/components/Recibo";
import { miSocio } from "@/lib/app/socio";
import { intentar } from "@/lib/panel/intentar";
import { ErrorDatos, rpc } from "@/lib/panel/servidor";
import type { ReciboDatos } from "@/lib/recibo";

export const metadata: Metadata = { title: "Mi recibo" };

/** VD-56: el recibo de un pago del socio. La base solo lo entrega si la venta es suya. */
export default async function ReciboSocio({ params, searchParams }: { params: Promise<{ venta: string }>; searchParams: Promise<{ socio?: string }> }) {
  const { venta } = await params;
  const pedido = (await searchParams).socio;
  return intentar(async () => {
    const { yo } = await miSocio(pedido);
    if (yo.elegir || !yo.socio) return <p className="texto-suave">Elegí primero <Link href="/app" className="underline">qué socio sos</Link>.</p>;
    if (!/^[0-9a-f-]{36}$/i.test(venta)) throw new ErrorDatos("Ese recibo no existe.", "22023", 404);
    const r = await rpc<ReciboDatos>("recibo_venta", { p_venta_id: venta }, { lectura: true });
    const q = yo.socios.length > 1 ? `?socio=${yo.socio.socio_id}` : "";
    return <Recibo r={r} volver={<Link href={`/app/historial${q}`} className="texto-suave">← Mi historial</Link>} />;
  });
}
