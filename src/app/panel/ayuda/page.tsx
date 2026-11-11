import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { CentroAyuda } from "@/components/ayuda/CentroAyuda";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel } from "@/lib/panel/servidor";
import { seccionesPara } from "@/lib/panel/secciones";
import { VERSION_PREGUNTAS, preguntasPara } from "@/lib/ayuda-preguntas";

export const metadata: Metadata = { title: "Ayuda" };

/** VD-63: preguntas cortas para tu rol, con el botón que lleva a hacerlo. Las secciones que el gimnasio apagó no aparecen. */
export default async function Ayuda({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    const preguntas = preguntasPara("panel", { rol: panel.yo.rol, secciones: seccionesPara(panel.yo.rol, panel.secciones_apagadas) });
    return (
      <>
        <Encabezado icono="ayuda" titulo="Ayuda" bajada="Buscá lo que no sepas hacer. Cada respuesta tiene el botón que te lleva a hacerlo. Con Ctrl+K también las encontrás." />
        <p className="mb-6"><Link href="/panel/ayuda/guias" className="boton" data-ayuda-guias>Guías de uso para leer o imprimir</Link></p>
        <CentroAyuda preguntas={preguntas} abierta={sp.p ?? null} version={VERSION_PREGUNTAS} />
      </>
    );
  });
}
