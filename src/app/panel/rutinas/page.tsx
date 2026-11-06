import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { Ejercicios } from "./Ejercicios";
import type { Ejercicio } from "./tipos";

export const metadata: Metadata = { title: "Rutinas" };
type Rutina = { id: string; nombre: string; descripcion: string | null; dias: number; ejercicios: number; plantilla?: boolean; asignados?: number };
type Progreso = { socio_id: string; nombre: string; rutina: string; asignada_en: string; cambiar_en: string | null; toca_cambiar: boolean; veces_30: number; ultima: string | null; hoy: boolean };

const fecha = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** RUT-1 + VD-20: las rutinas y plantillas, quién la hizo, y la biblioteca de ejercicios. */
export default async function Rutinas() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado", "profe"]);
    exigirSeccion(panel, "rutinas");
    const [rutinas, ejercicios, progreso] = await Promise.all([
      rpc<Rutina[]>("rutinas_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Ejercicio[]>("ejercicios_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Progreso[]>("rutinas_progreso_equipo", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    const hayEjercicios = ejercicios.some((e) => e.activo);
    const plantillas = rutinas.filter((r) => r.plantilla);
    const propias = rutinas.filter((r) => !r.plantilla);
    const tarjeta = (r: Rutina) => (
      <li key={r.id}><Link href={`/panel/rutinas/editar?id=${r.id}`} className="tarjeta flex flex-col gap-1 px-4 py-3 min-h-[68px] hover:bg-[var(--tarjeta-alta)] transition-colors">
        <span className="font-semibold text-lg break-words">{r.plantilla ? "⭐ " : ""}{r.nombre}</span>
        <span className="text-sm texto-suave">{r.dias === 1 ? "1 día" : `${r.dias} días`} · {r.ejercicios} ejercicios{r.asignados ? ` · ${r.asignados} ${r.asignados === 1 ? "socio" : "socios"}` : ""}{r.descripcion ? ` · ${r.descripcion}` : ""}</span>
      </Link></li>
    );
    return (
      <>
        <Encabezado emoji="💪" titulo="Rutinas" bajada="Armá rutinas con los ejercicios del gimnasio y asignáselas a los socios, de a uno o a varios."
          accion={hayEjercicios ? <Link href="/panel/rutinas/editar" className="boton boton-principal">➕ Nueva rutina</Link> : undefined} />
        <div className="space-y-12">
          {plantillas.length > 0 && (
            <section className="space-y-3" data-plantillas={plantillas.length}>
              <h2 className="titulo text-3xl">⭐ Plantillas <span className="texto-tenue text-xl">{plantillas.length}</span></h2>
              <p className="texto-suave text-sm">Abrí una y tocá “Usar esta plantilla” para sacar tu copia, o asignala directo a varios socios.</p>
              <ul className="grid sm:grid-cols-2 gap-2">{plantillas.map(tarjeta)}</ul>
            </section>
          )}
          <section className="space-y-3" data-rutinas>
            <h2 className="titulo text-3xl">📋 Rutinas <span className="texto-tenue text-xl">{propias.length}</span></h2>
            {propias.length === 0
              ? <p className="texto-suave">{hayEjercicios ? "Todavía no hay rutinas: tocá “Nueva rutina”." : "Primero sumá los ejercicios (abajo); después armás las rutinas."}</p>
              : <ul className="grid sm:grid-cols-2 gap-2">{propias.map(tarjeta)}</ul>}
          </section>
          <section className="space-y-3" data-quien-la-hizo={progreso.length}>
            <h2 className="titulo text-3xl">✅ Quién la hizo <span className="texto-tenue text-xl">{progreso.length}</span></h2>
            {progreso.length === 0
              ? <p className="texto-suave">Cuando asignes una rutina, acá ves quién entrena con ella y a quién le toca cambiarla.</p>
              : (
                <ul className="space-y-2">{progreso.map((p) => (
                  <li key={p.socio_id} className="tarjeta flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3" data-progreso-socio={p.nombre}>
                    <Link href={`/panel/rutinas/socio?id=${p.socio_id}`} className="font-semibold underline-offset-2 hover:underline min-w-0 break-words">{p.nombre}</Link>
                    <span className="texto-suave text-sm min-w-0 break-words">{p.rutina}</span>
                    <span className="flex flex-wrap gap-2 ml-auto">
                      {p.toca_cambiar && <span className="pildora pildora-amarillo">Toca cambiarla</span>}
                      <span className={`pildora ${p.hoy ? "pildora-verde" : ""}`}>{p.hoy ? "Entrenó hoy" : p.ultima ? `Última vez: ${fecha(p.ultima)}` : "Todavía no marcó nada"}</span>
                      <span className="pildora">{p.veces_30} {p.veces_30 === 1 ? "vez" : "veces"} en 30 días</span>
                    </span>
                  </li>
                ))}</ul>
              )}
          </section>
          <Ejercicios ejercicios={ejercicios} />
        </div>
      </>
    );
  });
}
