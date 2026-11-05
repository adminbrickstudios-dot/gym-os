import type { Metadata } from "next";
import { Encabezado } from "@/components/panel/Marco";
import { SelectorSede } from "@/components/panel/SelectorSede";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";
import { Puerta } from "./Puerta";
import { Hoy, type Ingreso } from "./Hoy";

export const metadata: Metadata = { title: "Entrada" };


export default async function Entrada({ searchParams }: { searchParams: Promise<{ sede?: string }> }) {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "entrada");
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    const { sede, puedeCambiar } = sedeActiva(panel, (await searchParams).sede);
    const hoy = await rpc<Ingreso[]>("ingresos_del_dia", { p_gimnasio_id: panel.gimnasio.id, p_sede_id: sede.id });

    return (
      <>
        <Encabezado emoji="🚪" titulo="Entrada" bajada="Buscá al socio: te dice si puede entrar y, si no, por qué." />
        {puedeCambiar && <SelectorSede sedes={panel.sedes} actual={sede.id} ruta="/panel/entrada" />}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-10 [&>*]:min-w-0">
          <Puerta sedeId={sede.id} />
          <Hoy ingresos={hoy} zona={panel.gimnasio.zona_horaria} />
        </div>
      </>
    );
  });
}
