import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { Grilla, type Actividad, type Horario } from "./Grilla";

export const metadata: Metadata = { title: "Grilla de clases" };
type Miembro = { equipo_id: string; nombre: string; rol: string; activo: boolean };

export default async function PaginaGrilla() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "clases");
    exigirRol(panel, ["dueno", "encargado"]);
    const [actividades, horarios, equipo] = await Promise.all([
      rpc<Actividad[]>("actividades_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Horario[]>("horarios_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Miembro[]>("equipo_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    return (
      <>
        <Link href="/panel/clases" className="texto-suave hover:text-[var(--texto)]">← Clases</Link>
        <div className="mt-4"><Encabezado emoji="🧩" titulo="Grilla" bajada="Las actividades y en qué horarios se dan. Las clases de cada día salen de acá." /></div>
        <Grilla actividades={actividades} horarios={horarios} sedes={panel.sedes.map((s) => ({ id: s.id, nombre: s.nombre }))}
          profes={equipo.filter((e) => e.activo).map((e) => ({ id: e.equipo_id, nombre: e.nombre }))} />
      </>
    );
  });
}
