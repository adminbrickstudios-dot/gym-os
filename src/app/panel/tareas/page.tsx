import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { Vacio } from "@/components/ui/Vacio";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { rutaDisponible } from "@/lib/panel/secciones";
import { AutomaticasHoy, ChecklistHoy, ConfigurarAutomaticas, type Automatica, type ConfigAuto, type ItemChecklist, type PersonaConfig } from "./Hoy";
import { FilaTarea, NuevaTarea, type Persona, type Tarea } from "./Tareas";

export const metadata: Metadata = { title: "Para hacer hoy" };

/**
 * VD-13 · Para hacer hoy: lo que se calcula solo (vencen hoy, prometieron, transferencias, caja…), el checklist de
 * apertura y cierre, y las tareas que se anotan a mano (COM-4: cada uno ve las suyas; dueño y encargado, todas).
 * La ruta de siempre es /panel/tareas; /panel/hoy redirige acá.
 */
export default async function PaginaTareas({ searchParams }: { searchParams: Promise<{ todas?: string; socio?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    const rol = panel.yo.rol;
    const gestion = rol === "dueno" || rol === "encargado";
    const todas = gestion && sp.todas === "1";
    const socioId = /^[0-9a-f-]{36}$/.test(sp.socio ?? "") ? sp.socio! : null;
    const [datos, ficha, auto, checklist, config] = await Promise.all([
      rpc<{ hoy: string; tareas: Tarea[]; equipo: Persona[] }>("tareas_panel", { p_gimnasio_id: panel.gimnasio.id, p_todas: todas }),
      socioId && rol !== "profe" ? rpc<{ socio: { nombre: string; apellido: string } }>("ficha_socio", { p_socio_id: socioId }) : Promise.resolve(null),
      // El profe no ve la plata ni los socios de la recepción: su pantalla son solo las tareas que le dieron.
      rol !== "profe" ? rpc<Automatica[]>("para_hacer_hoy", { p_gimnasio_id: panel.gimnasio.id }) : Promise.resolve([] as Automatica[]),
      rol !== "profe" ? rpc<{ items: ItemChecklist[] }>("checklist_hoy", { p_gimnasio_id: panel.gimnasio.id }) : Promise.resolve({ items: [] as ItemChecklist[] }),
      gestion ? rpc<{ automaticas: ConfigAuto[]; equipo: PersonaConfig[] }>("tareas_auto_config", { p_gimnasio_id: panel.gimnasio.id }) : Promise.resolve(null),
    ]);
    const socio = ficha && socioId ? { id: socioId, nombre: `${ficha.socio.nombre} ${ficha.socio.apellido}`.trim() } : null;
    // Lo que lleva a una pantalla apagada (o que el rol no ve) no se muestra: no hay a dónde ir.
    const automaticas = auto.filter((x) => rutaDisponible(`/panel${x.href}`, rol, panel.secciones_apagadas));
    const pendientes = datos.tareas.filter((t) => !t.hecha_en);
    const hechas = datos.tareas.filter((t) => t.hecha_en);
    return (
      <>
        <Encabezado emoji="✅" titulo="Para hacer hoy" bajada="Lo que hay que hacer hoy: lo que se calcula solo, el checklist y las tareas que anotás vos." />

        {rol !== "profe" && (
          <section aria-labelledby="automaticas" className="mb-10" data-hoy-automaticas={automaticas.length}>
            <h2 id="automaticas" className="titulo text-3xl mb-4">⚡ Se calcula solo{automaticas.length > 0 ? ` (${automaticas.length})` : ""}</h2>
            {automaticas.length === 0
              ? <Vacio emoji="✨" titulo="Todo al día">Nada para cobrar, aprobar ni avisar ahora. Cuando aparezca algo, lo ves acá y desaparece solo cuando lo resolvés.</Vacio>
              : <AutomaticasHoy items={automaticas} />}
          </section>
        )}

        {rol !== "profe" && <div className="mb-10"><ChecklistHoy items={checklist.items} puedeEditar={gestion} /></div>}

        <h2 className="titulo text-3xl mb-4">📌 Tareas</h2>
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
          <ul className="lista-entra space-y-2" data-tareas-pendientes={pendientes.length}>
            {pendientes.map((t) => <FilaTarea key={t.id} t={t} hoy={datos.hoy} mostrarPara={todas || !t.mia} />)}
          </ul>
        )}
        {hechas.length > 0 && (
          <section className="mt-10 space-y-2">
            <h2 className="titulo-grupo">Hechas esta semana</h2>
            <ul className="lista-entra space-y-2">{hechas.map((t) => <FilaTarea key={t.id} t={t} hoy={datos.hoy} mostrarPara={todas || !t.mia} />)}</ul>
          </section>
        )}

        {config && <div className="mt-10"><ConfigurarAutomaticas automaticas={config.automaticas} equipo={config.equipo} /></div>}
      </>
    );
  });
}
