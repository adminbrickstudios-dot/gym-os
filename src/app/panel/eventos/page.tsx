import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { Vacio } from "@/components/ui/Vacio";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { FilaEvento, NuevoEvento, type Evento } from "./Eventos";

export const metadata: Metadata = { title: "Eventos" };

/** COM-8: seminarios y clases especiales con cupo y precio. Se venden en Vender como un producto. */
export default async function PaginaEventos() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const gestion = panel.yo.rol !== "recepcion";
    const eventos = await rpc<Evento[]>("eventos_panel", { p_gimnasio_id: panel.gimnasio.id });
    return (
      <>
        <Encabezado icono="ticket" titulo="Eventos" bajada="Un seminario o una clase especial, con cupo y precio. Se vende en Vender y sale en tu página y en la app." />
        {gestion && <div className="mb-8"><NuevoEvento zona={panel.gimnasio.zona_horaria} /></div>}
        {eventos.length === 0
          ? <Vacio icono="ticket" titulo="No hay eventos">{gestion ? "Creá uno con “Nuevo evento”." : "Cuando el dueño cree uno, aparece acá para venderlo."}</Vacio>
          : <ul className="space-y-3" data-eventos={eventos.length}>{eventos.map((e) => <FilaEvento key={e.evento_id} e={e} puedeCerrar={gestion} />)}</ul>}
      </>
    );
  });
}
