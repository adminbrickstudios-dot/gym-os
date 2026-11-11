import type { Metadata } from "next";
import Link from "next/link";
import { GuiaHoja } from "@/components/ayuda/GuiaHoja";
import { guiaDe, pasosVisibles } from "@/lib/guias";
import { traerLanding } from "@/lib/landing";
import { miSocio } from "@/lib/app/socio";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";

export const metadata: Metadata = { title: "Guía del socio" };

/** C3: la guía del socio, para leer en el celular y para imprimir. Clases y rutina solo si el gimnasio las tiene. */
export default async function GuiaSocio({ searchParams }: { searchParams: Promise<{ socio?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const { g } = await miSocio(sp.socio);
    const [pestanas, landing] = await Promise.all([
      rpc<{ clases: boolean; rutina: boolean }>("pestanas_app", { p_gimnasio_id: g.id }),
      traerLanding(g.host).catch(() => null),
    ]);
    // Las claves son las de las secciones del panel: en la app "rutina" es la sección "rutinas".
    const visibles = new Set([pestanas.clases && "clases", pestanas.rutina && "rutinas"].filter((x): x is string => !!x));
    const guia = guiaDe("socio");
    return (
      <div className="space-y-5">
        <div>
          <Link href="/app/ayuda" className="inline-block texto-suave mb-3">← Ayuda</Link>
          <h1 className="titular text-5xl">{guia.titulo}</h1>
          <p className="texto-suave mt-2">{guia.bajada}</p>
        </div>
        <GuiaHoja guia={guia} pasos={pasosVisibles(guia, visibles, false)} conLinks={false} gimnasio={landing?.marca.nombre ?? "Tu gimnasio"} logoPath={landing?.marca.logo_path} />
      </div>
    );
  });
}
