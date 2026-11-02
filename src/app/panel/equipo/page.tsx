import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { Equipo, type Miembro } from "./Equipo";

export const metadata: Metadata = { title: "Equipo" };

export default async function PaginaEquipo() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const miembros = await rpc<Miembro[]>("equipo_gimnasio", { p_gimnasio_id: panel.gimnasio.id });
    return (
      <>
        <Encabezado emoji="🧑‍🤝‍🧑" titulo="Equipo" bajada="Quién trabaja en el gimnasio y qué puede hacer cada uno." />
        <Equipo miembros={miembros} sedes={panel.sedes} puedeEditar={panel.yo.rol === "dueno"} />
      </>
    );
  });
}
