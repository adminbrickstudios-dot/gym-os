import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import type { ItemRutina } from "../acciones";
import type { Ejercicio } from "../tipos";
import { Editor } from "./Editor";
import { AsignarRutina } from "./Asignar";
import { AccionesRutina } from "./AccionesRutina";

export const metadata: Metadata = { title: "Rutina" };

export default async function EditarRutina({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado", "profe"]);
    exigirSeccion(panel, "rutinas");
    const [ejercicios, r, lista] = await Promise.all([
      rpc<Ejercicio[]>("ejercicios_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      id ? rpc<{ nombre: string; descripcion: string | null; items: ItemRutina[] }>("rutina_detalle", { p_rutina_id: id }) : null,
      id ? rpc<{ id: string; plantilla: boolean; asignados: number }[]>("rutinas_gimnasio", { p_gimnasio_id: panel.gimnasio.id }) : null,
    ]);
    const meta = lista?.find((x) => x.id === id);
    return (
      <>
        <Link href="/panel/rutinas" className="texto-suave">← Rutinas</Link>
        <Encabezado icono="lista" titulo={r ? r.nombre : "Nueva rutina"} bajada="Por días: en cada uno, los ejercicios con series y repeticiones." />
        <div className="space-y-10">
          {id && r && <AccionesRutina rutinaId={id} nombre={r.nombre} plantilla={meta?.plantilla ?? false} asignados={meta?.asignados ?? 0} />}
          {id && r && <AsignarRutina rutinaId={id} />}
          <Editor key={id ?? "nueva"} id={id ?? null} ejercicios={ejercicios} inicial={{ nombre: r?.nombre ?? "", descripcion: r?.descripcion ?? "", items: r?.items ?? [] }} />
        </div>
      </>
    );
  });
}
