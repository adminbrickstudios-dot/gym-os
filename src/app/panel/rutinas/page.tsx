import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { Ejercicios } from "./Ejercicios";
import type { Ejercicio } from "./tipos";

export const metadata: Metadata = { title: "Rutinas" };
type Rutina = { id: string; nombre: string; descripcion: string | null; dias: number; ejercicios: number };

/** RUT-1: las rutinas plantilla y la biblioteca de ejercicios. */
export default async function Rutinas() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado", "profe"]);
    exigirSeccion(panel, "rutinas");
    const [rutinas, ejercicios] = await Promise.all([
      rpc<Rutina[]>("rutinas_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Ejercicio[]>("ejercicios_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    const hayEjercicios = ejercicios.some((e) => e.activo);
    return (
      <>
        <Encabezado emoji="💪" titulo="Rutinas" bajada="Armá rutinas con los ejercicios del gimnasio y asignáselas a los socios."
          accion={hayEjercicios ? <Link href="/panel/rutinas/editar" className="boton boton-principal">➕ Nueva rutina</Link> : undefined} />
        <div className="space-y-12">
          <section className="space-y-3" data-rutinas>
            <h2 className="titulo text-3xl">📋 Rutinas <span className="texto-tenue text-xl">{rutinas.length}</span></h2>
            {rutinas.length === 0
              ? <p className="texto-suave">{hayEjercicios ? "Todavía no hay rutinas: tocá “Nueva rutina”." : "Primero sumá los ejercicios (abajo); después armás las rutinas."}</p>
              : <ul className="grid sm:grid-cols-2 gap-2">{rutinas.map((r) => (
                  <li key={r.id}><Link href={`/panel/rutinas/editar?id=${r.id}`} className="tarjeta flex flex-col gap-1 px-4 py-3 min-h-[68px] hover:bg-[var(--tarjeta-alta)] transition-colors">
                    <span className="font-semibold text-lg">{r.nombre}</span>
                    <span className="text-sm texto-suave">{r.dias === 1 ? "1 día" : `${r.dias} días`} · {r.ejercicios} ejercicios{r.descripcion ? ` · ${r.descripcion}` : ""}</span>
                  </Link></li>
                ))}</ul>}
          </section>
          <Ejercicios ejercicios={ejercicios} />
        </div>
      </>
    );
  });
}
