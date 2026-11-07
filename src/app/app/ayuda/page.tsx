import type { Metadata } from "next";
import Link from "next/link";
import { CentroAyuda } from "@/components/ayuda/CentroAyuda";
import { miSocio } from "@/lib/app/socio";
import { VERSION_PREGUNTAS, preguntasPara } from "@/lib/ayuda-preguntas";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";

export const metadata: Metadata = { title: "Ayuda" };

/** VD-63: preguntas cortas del socio, con el botón que lleva a hacerlo. Clases y rutina solo si el gimnasio las tiene. */
export default async function AyudaSocio({ searchParams }: { searchParams: Promise<{ p?: string; socio?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const { g } = await miSocio(sp.socio);
    const pestanas = await rpc<{ clases: boolean; rutina: boolean }>("pestanas_app", { p_gimnasio_id: g.id });
    const seccionesApp = [pestanas.clases && "clases", pestanas.rutina && "rutina"].filter((x): x is string => !!x);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="titular text-5xl">Ayuda</h1>
          <p className="texto-suave mt-2">Buscá lo que no sepas hacer. ¿Buscás horarios o el reglamento? Están en <Link href="/app/info" className="underline">Info del gimnasio</Link>.</p>
        </div>
        <CentroAyuda preguntas={preguntasPara("app", { seccionesApp })} abierta={sp.p ?? null} version={VERSION_PREGUNTAS} />
      </div>
    );
  });
}
