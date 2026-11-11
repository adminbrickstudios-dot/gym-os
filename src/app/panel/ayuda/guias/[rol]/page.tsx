import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Encabezado } from "@/components/panel/Marco";
import { GuiaHoja } from "@/components/ayuda/GuiaHoja";
import { esRolGuia, guiaDe, guiasDeRolPanel, pasosVisibles, type RolGuia } from "@/lib/guias";
import { intentar } from "@/lib/panel/intentar";
import { seccionesPara } from "@/lib/panel/secciones";
import { ErrorDatos, contextoPanel } from "@/lib/panel/servidor";

export const metadata: Metadata = { title: "Guía de uso" };

/** Con qué rol del panel se miran las secciones prendidas de cada guía (la del socio se mira como la ve el dueño: clases y rutinas). */
const ROL_DE_SECCIONES = { recepcion: "recepcion", dueno: "dueno", profe: "profe", socio: "dueno" } as const;

/** C3: la guía de un rol, para leer y para imprimir. Los pasos de una sección que el gimnasio apagó no aparecen. */
export default async function GuiaDeUso({ params }: { params: Promise<{ rol: string }> }) {
  const { rol } = await params;
  if (!esRolGuia(rol)) notFound();
  const r: RolGuia = rol;
  return intentar(async () => {
    const panel = await contextoPanel();
    if (!guiasDeRolPanel(panel.yo.rol).includes(r)) throw new ErrorDatos("Tu rol no tiene acceso a esta guía", "42501", 403);
    const guia = guiaDe(r);
    const visibles = new Set(seccionesPara(ROL_DE_SECCIONES[r], panel.secciones_apagadas).map((s) => s.clave));
    const pasos = pasosVisibles(guia, visibles, guia.ambito === "panel");
    return (
      <>
        <Encabezado icono="ayuda" titulo={guia.titulo} bajada={`${guia.paraQuien}. ${guia.bajada}`} volver={{ href: "/panel/ayuda/guias", texto: "Guías de uso" }} />
        <GuiaHoja guia={guia} pasos={pasos} conLinks={guia.ambito === "panel"} gimnasio={panel.gimnasio.nombre} logoPath={panel.marca.logo_path} />
      </>
    );
  });
}
