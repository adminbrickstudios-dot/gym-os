import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { Editor, type Actividad, type Matricula, type Plan, type Producto } from "./Editor";
import type { ListaPrecios } from "./Precios";
import type { Stock } from "./acciones";

export const metadata: Metadata = { title: "Planes y precios" };

export default async function Planes() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    const [planes, productos, matriculas, stock] = await Promise.all([
      rpc<Plan[]>("planes_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Producto[]>("productos_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Record<string, Matricula>>("matriculas_planes", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Record<string, Stock>>("stock_productos", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    // La lista de precios de cada plan (general, por medio y por día): PLA-5.
    const listas = Object.fromEntries(await Promise.all(planes.map(async (p) =>
      [p.plan_id, await rpc<ListaPrecios>("lista_precios_plan", { p_plan_id: p.plan_id })] as const)));
    // Qué clases incluye cada plan (PLA-2): solo si el gimnasio usa clases.
    const conClases = !panel.secciones_apagadas.includes("clases");
    const [actividades, incluyen] = conClases ? await Promise.all([
      rpc<Actividad[]>("actividades_gimnasio", { p_gimnasio_id: panel.gimnasio.id }).then((l) => l.filter((a) => a.activa)),
      rpc<Record<string, string[]>>("actividades_por_plan", { p_gimnasio_id: panel.gimnasio.id }),
    ]) : [[], {}];
    return (
      <>
        <Encabezado emoji="🏷️" titulo="Planes y precios"
          accion={planes.some((p) => p.activo && p.precio != null) ? <Link href="/panel/planes/aumento" className="boton">📈 Aumento de precios</Link> : undefined} bajada="Lo que vendés y cuánto cuesta. Un aumento se programa con fecha y no toca lo ya cobrado." />
        <Editor planes={planes} listas={listas} actividades={actividades} incluyen={incluyen} matriculas={matriculas} stock={stock} productos={productos} zona={panel.gimnasio.zona_horaria} />
      </>
    );
  });
}
