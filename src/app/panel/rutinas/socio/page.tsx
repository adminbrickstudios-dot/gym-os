import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { MarcasProgreso, type Progreso } from "@/components/rutinas/Progreso";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";

export const metadata: Metadata = { title: "Progreso del socio" };

/** RUT-3: lo que ve el profe de un socio: su rutina y sus marcas. */
export default async function ProgresoSocio({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado", "profe"]);
    exigirSeccion(panel, "rutinas");
    if (!id) throw new Error("Falta el socio");
    const [p, r] = await Promise.all([
      rpc<Progreso>("progreso_socio", { p_socio_id: id }),
      rpc<{ nombre: string } | null>("rutina_de_socio", { p_socio_id: id }),
    ]);
    return (
      <>
        <Link href="/panel/rutinas" className="texto-suave">← Rutinas</Link>
        <Encabezado emoji="🏆" titulo={p.socio} bajada={r ? `Rutina: ${r.nombre}` : "Sin rutina asignada"} />
        <MarcasProgreso datos={p} zona={panel.gimnasio.zona_horaria} />
      </>
    );
  });
}
