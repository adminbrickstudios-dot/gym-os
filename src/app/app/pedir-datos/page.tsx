import type { Metadata } from "next";
import Link from "next/link";
import { miSocio } from "@/lib/app/socio";
import { intentar } from "@/lib/panel/intentar";
import { PedirDatos } from "./PedirDatos";

export const metadata: Metadata = { title: "Pedir mis datos" };

/** Ley 25.326: el socio pide ver, corregir o borrar sus datos. El gimnasio lo resuelve desde Datos personales. */
export default async function PedirMisDatos({ searchParams }: { searchParams: Promise<{ socio?: string }> }) {
  const pedido = (await searchParams).socio;
  return intentar(async () => {
    const { yo } = await miSocio(pedido);
    if (yo.elegir || !yo.socio) return <p className="texto-suave">Elegí primero <Link href="/app" className="underline">qué socio sos</Link>.</p>;
    const q = yo.socios.length > 1 ? `?socio=${yo.socio.socio_id}` : "";
    return (
      <div className="space-y-6" data-pedir-datos>
        <Link href={`/app/yo${q}`} className="texto-suave">← Volver</Link>
        <h1 className="titular text-5xl">Pedir mis datos</h1>
        <p className="texto-suave text-lg">Tenés derecho a ver, corregir o borrar los datos que el gimnasio guarda de vos. El gimnasio te contesta por acá o por el medio que tenga.</p>
        <PedirDatos socioId={yo.socio.socio_id} />
        <p className="texto-suave text-sm">Si querés una copia ya mismo, podés <a href={`/app/mis-datos${q}`} download className="underline">descargar tus datos</a>. <Link href="/privacidad" className="underline">Política de privacidad</Link>.</p>
      </div>
    );
  });
}
