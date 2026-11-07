import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { Lockers, type DatosLockers } from "./Lockers";

export const metadata: Metadata = { title: "Lockers" };

/** VD-55 (caso 60): qué locker tiene cada socio y cuándo vence. El estado (libre, ocupado, vencido) lo calcula la base. */
export default async function PaginaLockers() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "lockers");
    const r = await rpc<DatosLockers>("lockers_panel", { p_gimnasio_id: panel.gimnasio.id });
    return (
      <div data-lockers>
        <Encabezado emoji="🔐" titulo="Lockers"
          bajada="Quién tiene cada locker y cuándo vence. El alquiler se cobra como cualquier venta, y después se asigna el locker." />
        <Lockers datos={r} zona={panel.gimnasio.zona_horaria} />
      </div>
    );
  });
}
