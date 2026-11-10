import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol } from "@/lib/panel/servidor";
import { cargarInteresados } from "./Interesados";
import { Prospectos } from "./Prospectos";

export const metadata: Metadata = { title: "Interesados" };

// VD-15 (D22): los Prospectos pasaron a Socios → Interesados. Esta dirección sigue andando (links guardados,
// e2e, el menú de VD-11) y lleva a la pestaña. Solo si el gimnasio tiene apagado Socios se muestra acá.
export default async function PaginaProspectos() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const sociosPrendido = !panel.secciones_apagadas.includes("socios");
    if (sociosPrendido) redirect("/panel/socios?vista=interesados");
    const { lista, pagina } = await cargarInteresados(panel);
    return (
      <>
        <Encabezado icono="hoja" titulo="Interesados" bajada="Los que quieren probar: de la página, del mostrador o recomendados. Escribiles rápido; el que prueba en la semana se queda." />
        <Prospectos lista={lista} pagina={pagina} zona={panel.gimnasio.zona_horaria} puedeAltas={false} />
      </>
    );
  });
}
