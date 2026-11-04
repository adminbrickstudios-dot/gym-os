import type { Metadata } from "next";
import { headers } from "next/headers";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { clasificarHost } from "@/lib/host";
import { dominioBase, dominioPlataforma } from "@/lib/dominios";
import { Ajustes, type Config, type DatosGimnasio } from "./Ajustes";
import type { CierrePanel } from "./Horarios";
import type { Agenda } from "@/lib/horarios";
import { PESTANAS, type ClavePestana } from "./pestanas";

export const metadata: Metadata = { title: "Configuración" };

/** La dirección de la página del gimnasio, vista desde donde está abierto el panel. */
async function direccionPagina(slug: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const enPlataforma = clasificarHost(host, dominioBase(), dominioPlataforma()).tipo === "plataforma";
  return enPlataforma ? `${proto}://${host}/g/${slug}` : `${proto}://${host}/`;
}

export default async function Configuracion({ searchParams }: { searchParams: Promise<{ pestana?: string }> }) {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const [config, datos, agenda, cierres, { pestana }] = await Promise.all([
      rpc<Config>("configuracion_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<DatosGimnasio>("datos_gimnasio_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Agenda>("horarios_apertura_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<CierrePanel[]>("cierres_panel", { p_gimnasio_id: panel.gimnasio.id }),
      searchParams,
    ]);
    const inicial: ClavePestana = PESTANAS.find((p) => p.clave === pestana)?.clave ?? "gimnasio";
    return (
      <>
        <Encabezado emoji="⚙️" titulo="Configuración" bajada="Los datos de tu gimnasio, tu marca, cómo cobrás y qué secciones usás." />
        <Ajustes inicial={config} datos={datos} agenda={agenda} cierres={cierres} puedeEditar={panel.yo.rol === "dueno"} pestanaInicial={inicial}
          direccionPagina={await direccionPagina(datos.slug)} />
      </>
    );
  });
}
