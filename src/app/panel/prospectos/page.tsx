import type { Metadata } from "next";
import { headers } from "next/headers";
import { traerLanding } from "@/lib/landing";
import { direccionPagina } from "@/lib/panel/direccion-pagina";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { Prospectos, type Prospecto } from "./Prospectos";

export const metadata: Metadata = { title: "Prospectos" };

export default async function PaginaProspectos() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const host = (await headers()).get("x-gimnasio-host");
    const [lista, landing] = await Promise.all([
      rpc<Prospecto[]>("prospectos_panel", { p_gimnasio_id: panel.gimnasio.id }),
      host ? traerLanding(host).catch(() => null) : null,
    ]);
    // REV-1b: el WhatsApp al prospecto lleva la página, si está publicada (si no, el link mostraría "Próximamente").
    const pagina = landing?.publicada ? await direccionPagina(panel.gimnasio.slug) : null;
    return (
      <>
        <Encabezado emoji="🌱" titulo="Prospectos" bajada="Los que quieren probar: de la página, del mostrador o recomendados. Escribiles rápido; el que prueba en la semana se queda." />
        <Prospectos lista={lista} pagina={pagina} zona={panel.gimnasio.zona_horaria} puedeAltas={!panel.secciones_apagadas.includes("socios")} />
      </>
    );
  });
}
