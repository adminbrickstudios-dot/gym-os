import type { Metadata } from "next";
import Link from "next/link";
import { miSocio } from "@/lib/app/socio";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";
import type { PtSocio } from "@/app/panel/pt/acciones";
import { MisSesiones } from "./MisSesiones";

export const metadata: Metadata = { title: "Mi personal trainer" };

/** VD-58: los packs de sesiones del socio, sus turnos y los horarios libres para reservar. Todo lo calcula la base. */
export default async function MiPt({ searchParams }: { searchParams: Promise<{ socio?: string }> }) {
  const pedido = (await searchParams).socio;
  return intentar(async () => {
    const { yo } = await miSocio(pedido);
    if (yo.elegir || !yo.socio) return <p className="texto-suave">Elegí primero <Link href="/app" className="underline">qué socio sos</Link>.</p>;
    const q = yo.socios.length > 1 ? `?socio=${yo.socio.socio_id}` : "";
    const r = await rpc<PtSocio>("pt_socio", { p_socio_id: yo.socio.socio_id });
    return (
      <div className="space-y-6" data-mi-pt>
        <Link href={`/app/yo${q}`} className="texto-suave">← Volver</Link>
        <h1 className="titular text-5xl">Mi personal trainer</h1>
        {!r.prendido || (!r.ofrece && (r.packs?.length ?? 0) === 0)
          ? <p className="texto-suave text-lg" data-sin-pt>Tu gimnasio todavía no ofrece sesiones con personal trainer.</p>
          : <MisSesiones socioId={yo.socio.socio_id} datos={r} zona={yo.zona!} />}
      </div>
    );
  });
}
