import type { Metadata } from "next";
import { headers } from "next/headers";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { traerAgenda } from "@/lib/landing";
import { direccionPagina } from "@/lib/panel/direccion-pagina";
import { Editor, type PaginaPanel } from "./Editor";

export const metadata: Metadata = { title: "Tu página" };

export default async function Pagina() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const host = (await headers()).get("x-gimnasio-host");
    const [pagina, agenda] = await Promise.all([
      rpc<PaginaPanel>("pagina_panel", { p_gimnasio_id: panel.gimnasio.id }),
      host ? traerAgenda(host) : Promise.resolve(null),
    ]);
    return (
      <>
        <Encabezado emoji="🌐" titulo="Tu página" bajada="Lo que ve la gente antes de hacerse socio. Cambiá los textos, mostrá u ocultá secciones, ordenalas y mirá cómo queda antes de guardar." />
        <Editor inicial={pagina} agenda={agenda} puedeEditar={panel.yo.rol === "dueno"} direccion={await direccionPagina(pagina.vista.marca.slug)} />
      </>
    );
  });
}
