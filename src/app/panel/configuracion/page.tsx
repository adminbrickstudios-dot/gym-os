import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { Ajustes, type Config } from "./Ajustes";

export const metadata: Metadata = { title: "Configuración" };

export default async function Configuracion() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const config = await rpc<Config>("configuracion_panel", { p_gimnasio_id: panel.gimnasio.id });
    return (
      <>
        <Encabezado emoji="⚙️" titulo="Configuración" bajada="Tu marca, cómo cobrás y qué secciones usás." />
        <Ajustes inicial={config} puedeEditar={panel.yo.rol === "dueno"} />
      </>
    );
  });
}
