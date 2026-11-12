import type { Metadata } from "next";
import Link from "next/link";
import { miSocio } from "@/lib/app/socio";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";
import { ComprarPlan, type OpcionesCompra } from "./ComprarPlan";

export const metadata: Metadata = { title: "Mi plan" };

/** VD-39 (D28): cambiar de plan o comprar un pase / pack desde la app, con lo que queda a favor calculado por la base. */
export default async function PlanSocio({ searchParams }: { searchParams: Promise<{ socio?: string }> }) {
  const pedido = (await searchParams).socio;
  return intentar(async () => {
    const { g, yo } = await miSocio(pedido);
    if (yo.elegir || !yo.socio) return <p className="texto-suave">Elegí primero <Link href="/app" className="underline">qué socio sos</Link>.</p>;
    const s = yo.socio;
    const q = yo.socios.length > 1 ? `?socio=${s.socio_id}` : "";
    const opciones = await rpc<OpcionesCompra>("opciones_compra_app", { p_socio_id: s.socio_id }, { lectura: true });
    return (
      <div className="space-y-6" data-plan-socio>
        <Link href={`/app/yo${q}`} className="texto-suave inline-flex min-h-11 items-center">← Volver</Link>
        <div>
          <h1 className="titular text-[28px]">Mi plan</h1>
          <p className="texto-suave text-lg mt-1">{opciones.plan_actual ? <>Ahora estás en <b>{opciones.plan_actual.nombre}</b>.</> : "Todavía no tenés un plan mensual."} Elegí otro plan o un pase.</p>
        </div>
        <ComprarPlan socioId={s.socio_id} gimnasioId={g.id} opciones={opciones} />
      </div>
    );
  });
}
