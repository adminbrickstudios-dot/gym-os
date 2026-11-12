import type { Metadata } from "next";
import Link from "next/link";
import { miSocio } from "@/lib/app/socio";
import { MOTIVOS } from "@/lib/mensajes";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";
import { FormMensaje } from "../FormMensaje";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "Nuevo mensaje" };

export default async function NuevoMensaje({ searchParams }: { searchParams: Promise<{ socio?: string; motivo?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const { yo } = await miSocio(sp.socio);
    if (yo.elegir || !yo.socio) return <p className="texto-suave">Elegí primero <Link href="/app" className="underline">qué socio sos</Link>.</p>;
    const s = yo.socio;
    const q = yo.socios.length > 1 ? `?socio=${s.socio_id}` : "";
    const estado = await rpc<{ activo: boolean }>("mensajes_estado_socio", { p_socio_id: s.socio_id });
    return (
      <div className="space-y-6">
        <Link href={`/app/mensajes${q}`} className="texto-suave inline-flex min-h-11 items-center">← Volver</Link>
        <h1 className="titular text-[28px]"><Icono nombre="mail" /> Nuevo mensaje</h1>
        {estado.activo
          ? <FormMensaje socioId={s.socio_id} q={q} motivoInicial={MOTIVOS.find((m) => m.clave === sp.motivo)?.clave} />
          : <p className="tarjeta p-5 texto-suave">Por ahora este gimnasio no recibe mensajes por la app. Hablá con la recepción.</p>}
      </div>
    );
  });
}
