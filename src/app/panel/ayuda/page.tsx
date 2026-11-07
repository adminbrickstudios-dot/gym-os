import type { Metadata } from "next";
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
        <Encabezado emoji="❓" titulo="Ayuda" bajada="Buscá lo que no sepas hacer. Cada respuesta tiene el botón que te lleva a hacerlo. Con Ctrl+K también las encontrás." />
        <CentroAyuda preguntas={preguntas} abierta={sp.p ?? null} version={VERSION_PREGUNTAS} />
      </>
    );
  });
}
