import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { Vacio } from "@/components/ui/Vacio";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { FilaCupon, NuevoCupon, type CuponPanel } from "./Cupones";

export const metadata: Metadata = { title: "Cupones" };

/** COM-9: códigos de descuento para campañas. Se usan en Vender; cada uno dice cuántos socios trajo. */
export default async function PaginaCupones() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const [cupones, planes] = await Promise.all([
      rpc<CuponPanel[]>("cupones_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<{ plan_id: string; nombre: string; activo: boolean }[]>("planes_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    const esDueno = panel.yo.rol === "dueno";
    return (
      <>
        <Encabezado icono="etiqueta" titulo="Cupones" volver={{ href: "/panel/planes", texto: "Planes y servicios" }} volverAlOrigen
          bajada="Un código para una campaña: en Vender se escribe y el descuento se carga solo en lo que corresponde. Cada uno dice cuántos socios trajo." />
        {esDueno && <div className="mb-8"><NuevoCupon planes={planes.filter((p) => p.activo)} /></div>}
        {cupones.length === 0
          ? <Vacio icono="etiqueta" titulo="Todavía no hay cupones">{esDueno ? "Creá uno con “Nuevo cupón”." : "Los crea el dueño."}</Vacio>
          : <ul className="space-y-2" data-cupones={cupones.length}>{cupones.map((c) => <FilaCupon key={c.cupon_id} c={c} puedeEditar={esDueno} zona={panel.gimnasio.zona_horaria} />)}</ul>}
      </>
    );
  });
}
