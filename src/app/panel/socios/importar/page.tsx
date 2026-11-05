import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { Importador, type Importacion } from "./Importador";

export const metadata: Metadata = { title: "Importar socios" };

export default async function ImportarSocios() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "socios");
    exigirRol(panel, ["dueno", "encargado"]);
    const anteriores = await rpc<Importacion[]>("importaciones_panel", { p_gimnasio_id: panel.gimnasio.id });
    return (
      <>
        <Encabezado emoji="📥" titulo="Importar socios" bajada="Subí tu Excel o CSV: elegís qué columna es qué, revisás y entran todos juntos. Si algo salió mal, lo deshacés durante 24 horas." />
        <Importador anteriores={anteriores} zona={panel.gimnasio.zona_horaria} />
      </>
    );
  });
}
