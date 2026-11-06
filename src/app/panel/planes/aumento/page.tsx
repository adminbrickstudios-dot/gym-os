import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import type { Plan } from "../Editor";
import { Aumento } from "./Aumento";

export const metadata: Metadata = { title: "Aumento de precios" };

export default async function PaginaAumento() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const planes = (await rpc<Plan[]>("planes_gimnasio", { p_gimnasio_id: panel.gimnasio.id })).filter((p) => p.activo);
    const zona = panel.gimnasio.zona_horaria;
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date());
    const [a, m] = hoy.split("-").map(Number);
    const primeroDelMes = `${m === 12 ? a + 1 : a}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
    return (
      <>
        <Encabezado emoji="📈" titulo="Aumento de precios" volver={{ href: "/panel/planes", texto: "Planes y precios" }} volverAlOrigen
          bajada="Varios planes a la vez, desde un día. Lo ya cobrado no cambia; hasta ese día se cobra el precio de hoy." />
        <Aumento planes={planes} hoy={hoy} sugerido={primeroDelMes} zona={zona} gimnasio={panel.gimnasio.nombre} />
      </>
    );
  });
}
