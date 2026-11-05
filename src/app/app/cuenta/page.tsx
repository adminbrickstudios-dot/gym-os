import type { Metadata } from "next";
import Link from "next/link";
import { miSocio } from "@/lib/app/socio";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";
import { PedirBaja, PedirPausa } from "./Pedidos";

export const metadata: Metadata = { title: "Mi membresía" };

/** APP-8: pedir una pausa o la baja sin tener que ir al mostrador. */
export default async function Cuenta({ searchParams }: { searchParams: Promise<{ socio?: string }> }) {
  const pedido = (await searchParams).socio;
  return intentar(async () => {
    const { yo } = await miSocio(pedido);
    if (yo.elegir || !yo.socio) return <p className="texto-suave">Elegí primero <Link href="/app" className="underline">qué socio sos</Link>.</p>;
    const s = yo.socio;
    const q = yo.socios.length > 1 ? `?socio=${s.socio_id}` : "";
    const baja = await rpc<{ motivo: string; pedido_en: string } | null>("pedido_baja_socio", { p_socio_id: s.socio_id });
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: yo.zona! }).format(new Date());
    return (
      <div className="space-y-6">
        <Link href={`/app${q}`} className="texto-suave">← Volver</Link>
        <h1 className="titular text-5xl">Mi membresía</h1>
        {yo.plan && <p className="texto-suave text-lg">🏷️ {yo.plan.nombre}</p>}
        {yo.plan ? <PedirPausa socioId={s.socio_id} hoy={hoy} /> : <p className="texto-suave">No tenés una membresía mensual para pausar.</p>}
        {baja
          ? <p className="mensaje mensaje-info" data-baja-pendiente>👋 Pediste la baja: el gimnasio te va a contactar.</p>
          : <PedirBaja socioId={s.socio_id} ofrecePausa={!!yo.plan} />}
      </div>
    );
  });
}
