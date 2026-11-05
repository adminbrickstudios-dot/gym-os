import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { Vacio } from "@/components/ui/Vacio";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { Pares, type Par } from "./Pares";

export const metadata: Metadata = { title: "Posibles duplicados" };

export default async function Duplicados() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "socios");
    exigirRol(panel, ["dueno", "encargado"]);
    const pares = await rpc<Par[]>("posibles_duplicados", { p_gimnasio_id: panel.gimnasio.id });
    return (
      <>
        <Encabezado volver={{ href: "/panel/socios", texto: "Socios" }} emoji="🔎" titulo="Posibles duplicados" bajada="Socios cargados dos veces (mismo celular o nombre casi igual). Al unirlos, todo lo del que se va pasa al que queda." />
        {pares.length === 0
          ? <Vacio emoji="✨" titulo="No hay duplicados">Cuando aparezcan dos fichas con el mismo celular o un nombre casi igual, las vas a ver acá.</Vacio>
          : <Pares pares={pares} zona={panel.gimnasio.zona_horaria} puedeUnir={panel.yo.rol === "dueno"} />}
      </>
    );
  });
}
