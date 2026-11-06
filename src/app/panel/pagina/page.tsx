import type { Metadata } from "next";
import { headers } from "next/headers";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { traerAgenda } from "@/lib/landing";
import { direccionPagina } from "@/lib/panel/direccion-pagina";
import { Editor, type PaginaPanel } from "./Editor";
import { Altas, type AltasPanel } from "./Altas";
import { PruebaSocial, type PruebaSocialPanel } from "./PruebaSocial";
import { MedicionPagina, type MedicionPanel } from "./MedicionPagina";

export const metadata: Metadata = { title: "Tu página" };

export default async function Pagina() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const host = (await headers()).get("x-gimnasio-host");
    const [pagina, altas, agenda, medicion, prueba] = await Promise.all([
      rpc<PaginaPanel>("pagina_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<AltasPanel>("altas_panel", { p_gimnasio_id: panel.gimnasio.id }),
      host ? traerAgenda(host) : Promise.resolve(null),
      rpc<MedicionPanel>("medicion_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<PruebaSocialPanel>("prueba_social_panel", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    return (
      <>
        <Encabezado emoji="🌐" titulo="Tu página" bajada="Lo que ve la gente antes de hacerse socio. Cambiá los textos, mostrá u ocultá secciones, ordenalas y mirá cómo queda antes de guardar." />
        <Editor inicial={pagina} agenda={agenda} puedeEditar={panel.yo.rol === "dueno"} direccion={await direccionPagina(pagina.vista.marca.slug)}
          altas={<Altas inicial={altas} puedeEditar={panel.yo.rol === "dueno"} />} />
        <PruebaSocial inicial={prueba} puedeEditar={panel.yo.rol === "dueno"} />
        <MedicionPagina inicial={medicion} puedeEditar={panel.yo.rol === "dueno"} />
      </>
    );
  });
}
