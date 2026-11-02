import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { Editor, type Plan, type Producto } from "./Editor";

export const metadata: Metadata = { title: "Planes y precios" };

export default async function Planes() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const [planes, productos] = await Promise.all([
      rpc<Plan[]>("planes_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Producto[]>("productos_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    return (
      <>
        <Encabezado emoji="🏷️" titulo="Planes y precios" bajada="Lo que vendés y cuánto cuesta. Un aumento se programa con fecha y no toca lo ya cobrado." />
        <Editor planes={planes} productos={productos} zona={panel.gimnasio.zona_horaria} />
      </>
    );
  });
}
