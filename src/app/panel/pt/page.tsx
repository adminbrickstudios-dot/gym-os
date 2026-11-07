import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { Pt, type DatosPt } from "./Pt";

export const metadata: Metadata = { title: "Personal trainer" };

/** VD-58: la agenda de los PT, los packs de sesiones y las reservas. El PT ve la suya; el dueño y el encargado, todas. */
export default async function PaginaPt() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "pt");
    const r = await rpc<DatosPt>("agenda_pt", { p_gimnasio_id: panel.gimnasio.id, p_entrenador_id: null, p_dias: 21 });
    return (
      <div data-pt>
        <Encabezado emoji="🏃" titulo="Personal trainer"
          bajada={r.mi_rol === "profe" ? "Tus horarios de atención y las sesiones que reservaron. Marcá cuáles diste." : "Los horarios de cada PT, las sesiones reservadas y los packs que vendés. El socio reserva desde la app o lo hace la recepción."} />
        <Pt datos={r} zona={panel.gimnasio.zona_horaria} />
      </div>
    );
  });
}
