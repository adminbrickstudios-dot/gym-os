import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { Tvs, type TvPanel } from "./Tvs";

export const metadata: Metadata = { title: "TV de la sala" };

/** COM-14: las TVs de la sala. Cada una muestra la clase de ahora, los anotados, el WOD y la que sigue. */
export default async function PaginaTvs() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "clases");
    exigirRol(panel, ["dueno", "encargado", "recepcion", "profe"]);
    const tvs = await rpc<TvPanel[]>("tvs_panel", { p_gimnasio_id: panel.gimnasio.id });
    return (
      <>
        <Encabezado icono="pantalla" titulo="TV de la sala" volver={{ href: "/panel/clases", texto: "Clases" }} volverAlOrigen
          bajada="Una pantalla en la sala: con las clases (la de ahora, los anotados, el WOD y la que sigue) o con las últimas entradas, y siempre cuánta gente hay adentro. Se actualiza sola, sin que nadie inicie sesión; el link se revoca cuando quieras." />
        <Tvs gimnasioId={panel.gimnasio.id} sedes={panel.sedes.map((s) => ({ id: s.id, nombre: s.nombre }))} tvs={tvs} puedeSacar={["dueno", "encargado"].includes(panel.yo.rol)} />
      </>
    );
  });
}
