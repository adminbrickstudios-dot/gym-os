import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { DatosPersonales, type PedidoDatos, type TerminosPropios } from "./DatosPersonales";

export const metadata: Metadata = { title: "Datos personales" };

/** Ley 25.326 (D52): la política de privacidad del gimnasio y los pedidos de los socios de ver, corregir o borrar sus datos. */
export default async function PaginaDatosPersonales() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const [pedidos, politica, terminos] = await Promise.all([
      rpc<PedidoDatos[]>("pedidos_datos_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<{ texto: string | null } | null>("politica_privacidad_propia", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<TerminosPropios>("terminos_propios", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    return (
      <>
        <Encabezado icono="candado" titulo="Datos personales" volver={{ href: "/panel/configuracion?pestana=reglas", texto: "Configuración" }}
          bajada="Lo que dice tu política de privacidad y lo que piden tus socios sobre sus datos (Ley 25.326)." />
        <DatosPersonales politica={politica?.texto ?? null} pedidos={pedidos} puedeEditar={panel.yo.rol === "dueno"} terminos={terminos} />
      </>
    );
  });
}
