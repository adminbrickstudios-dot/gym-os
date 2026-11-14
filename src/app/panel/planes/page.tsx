import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, fijo, lectura, lecturaPorCada, rpcLote } from "@/lib/panel/servidor";
import { Editor, type Actividad, type Matricula, type Plan, type Producto } from "./Editor";
import type { ListaPrecios } from "./Precios";
import type { AjustesPlanes, Convenio, Servicio, Stock } from "./acciones";
import { Convenios } from "./Convenios";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "Planes y servicios" };

export default async function Planes() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    // Qué clases incluye cada plan (PLA-2): solo si el gimnasio usa clases.
    const conClases = !panel.secciones_apagadas.includes("clases");
    // E8: todo en UN viaje a la base (lote_lecturas). La lista de precios de cada plan (general, por medio y por día: PLA-5) sale en el mismo viaje, una por plan.
    const [planes, productos, matriculas, stock, convenios, ajustes, servicios, listas, actividadesTodas, incluyen] = await rpcLote(
      lectura<Plan[]>("planes_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      lectura<Producto[]>("productos_mostrador", { p_gimnasio_id: panel.gimnasio.id }),
      lectura<Record<string, Matricula>>("matriculas_planes", { p_gimnasio_id: panel.gimnasio.id }),
      lectura<Record<string, Stock>>("stock_productos", { p_gimnasio_id: panel.gimnasio.id }),
      lectura<Convenio[]>("convenios_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      lectura<AjustesPlanes>("ajustes_planes", { p_gimnasio_id: panel.gimnasio.id }),
      lectura<Servicio[]>("servicios_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      lecturaPorCada<ListaPrecios>("lista_precios_plan", 0, "plan_id", "p_plan_id"),
      conClases ? lectura<Actividad[]>("actividades_gimnasio", { p_gimnasio_id: panel.gimnasio.id }) : fijo<Actividad[]>([]),
      conClases ? lectura<Record<string, string[]>>("actividades_por_plan", { p_gimnasio_id: panel.gimnasio.id }) : fijo<Record<string, string[]>>({}),
    );
    const actividades = actividadesTodas.filter((a) => a.activa);
    return (
      <>
        <Encabezado icono="etiqueta" titulo="Planes y servicios"
          accion={<span className="flex flex-wrap gap-2">
            {planes.some((p) => p.activo && p.precio != null) && <Link href="/panel/planes/aumento" className="boton"><Icono nombre="tendencia" /> Aumento de precios</Link>}
            <Link href="/panel/cupones" className="boton" data-ir-cupones><Icono nombre="etiqueta" /> Cupones</Link>
          </span>} bajada="Lo que vendés y cuánto cuesta. Un aumento se programa con fecha y no toca lo ya cobrado." />
        <Editor planes={planes} listas={listas} actividades={actividades} incluyen={incluyen} matriculas={matriculas} stock={stock} productos={productos} ajustes={ajustes} servicios={servicios} zona={panel.gimnasio.zona_horaria} />
        <div className="mt-12"><Convenios convenios={convenios} /></div>
      </>
    );
  });
}
