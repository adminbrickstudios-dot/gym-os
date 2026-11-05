import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { Vacio } from "@/components/ui/Vacio";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { FilaTarea, NuevaTarea, type Persona, type Tarea } from "./Tareas";

export const metadata: Metadata = { title: "Tareas" };

/** COM-4: las tareas del equipo. Cada uno ve las suyas; dueño y encargado, todas. */
export default async function PaginaTareas({ searchParams }: { searchParams: Promise<{ todas?: string; socio?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    const gestion = panel.yo.rol === "dueno" || panel.yo.rol === "encargado";
    const todas = gestion && sp.todas === "1";
    const socioId = /^[0-9a-f-]{36}$/.test(sp.socio ?? "") ? sp.socio! : null;
    const [datos, ficha] = await Promise.all([
      rpc<{ hoy: string; tareas: Tarea[]; equipo: Persona[] }>("tareas_panel", { p_gimnasio_id: panel.gimnasio.id, p_todas: todas }),
      socioId && panel.yo.rol !== "profe" ? rpc<{ socio: { nombre: string; apellido: string } }>("ficha_socio", { p_socio_id: socioId }) : Promise.resolve(null),
    ]);
    const socio = ficha && socioId ? { id: socioId, nombre: `${ficha.socio.nombre} ${ficha.socio.apellido}`.trim() } : null;
    const pendientes = datos.tareas.filter((t) => !t.hecha_en);
    const hechas = datos.tareas.filter((t) => t.hecha_en);
    return (
      <>
        <Encabezado emoji="📌" titulo="Tareas" bajada="Lo que hay que hacer, para quién y para cuándo. Las de hoy te aparecen en el Inicio." />
        {gestion && (
          <nav className="flex gap-2 mb-6" aria-label="De quién">
            <Link href="/panel/tareas" className="pestana" aria-current={!todas ? "page" : undefined}>Mías</Link>
            <Link href="/panel/tareas?todas=1" className="pestana" aria-current={todas ? "page" : undefined}>De todo el equipo</Link>
          </nav>
        )}
        <div className="mb-8"><NuevaTarea equipo={datos.equipo} hoy={datos.hoy} socio={socio} abierta={!!socio} /></div>
        {pendientes.length === 0 ? (
          <Vacio emoji="🎉" titulo="No hay tareas pendientes">Anotá una con “➕ Nueva tarea”, o desde la ficha de un socio.</Vacio>
        ) : (
          <ul className="space-y-2" data-tareas-pendientes={pendientes.length}>
            {pendientes.map((t) => <FilaTarea key={t.id} t={t} hoy={datos.hoy} mostrarPara={todas || !t.mia} />)}
          </ul>
        )}
        {hechas.length > 0 && (
          <section className="mt-10 space-y-2">
            <h2 className="titulo-grupo">Hechas esta semana</h2>
            <ul className="space-y-2">{hechas.map((t) => <FilaTarea key={t.id} t={t} hoy={datos.hoy} mostrarPara={todas || !t.mia} />)}</ul>
          </section>
        )}
      </>
    );
  });
}
