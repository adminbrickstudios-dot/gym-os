import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import type { Plan } from "../Editor";
import type { AumentoHecho } from "../acciones";
import { Aumento } from "./Aumento";

export const metadata: Metadata = { title: "Aumento de precios" };

export default async function PaginaAumento() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const planes = (await rpc<Plan[]>("planes_gimnasio", { p_gimnasio_id: panel.gimnasio.id })).filter((p) => p.activo);
    const [config, hechos] = await Promise.all([
      rpc<{ aviso_dias: number }>("config_aumento", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<AumentoHecho[]>("aumentos_hechos", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    const zona = panel.gimnasio.zona_horaria;
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date());
    const [a, m] = hoy.split("-").map(Number);
    // VD-46D: el sugerido respeta el aviso previo (el primer día de mes que deja los días de aviso).
    const piso = new Date(Date.UTC(a, m - 1, Number(hoy.split("-")[2]) + config.aviso_dias));
    const sig = new Date(Date.UTC(piso.getUTCFullYear(), piso.getUTCMonth() + (piso.getUTCDate() > 1 ? 1 : 0), 1));
    const primeroDelMes = sig.toISOString().slice(0, 10);
    return (
      <>
        <Encabezado icono="tendencia" titulo="Aumento de precios" volver={{ href: "/panel/planes", texto: "Planes y precios" }} volverAlOrigen
          bajada="Varios planes a la vez, desde un día con aviso previo. Lo ya cobrado no cambia; hasta ese día se cobra el precio de hoy." />
        <Aumento planes={planes} hoy={hoy} sugerido={primeroDelMes} zona={zona} gimnasio={panel.gimnasio.nombre}
          avisoDias={config.aviso_dias} esDueno={panel.yo.rol === "dueno"} hechos={hechos} />
      </>
    );
  });
}
