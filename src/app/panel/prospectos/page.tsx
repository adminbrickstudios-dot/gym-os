import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { Prospectos, type Prospecto } from "./Prospectos";

export const metadata: Metadata = { title: "Prospectos" };

export default async function PaginaProspectos() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const lista = await rpc<Prospecto[]>("prospectos_panel", { p_gimnasio_id: panel.gimnasio.id });
    return (
      <>
        <Encabezado emoji="🌱" titulo="Prospectos" bajada="Los que quieren probar: de la página, del mostrador o recomendados. Escribiles rápido; el que prueba en la semana se queda." />
        <Prospectos lista={lista} zona={panel.gimnasio.zona_horaria} puedeAltas={!panel.secciones_apagadas.includes("socios")} />
      </>
    );
  });
}
