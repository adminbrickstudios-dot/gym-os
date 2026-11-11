import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { Grilla, type Actividad, type Horario } from "./Grilla";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "Grilla de clases" };
type Miembro = { equipo_id: string; nombre: string; rol: string; activo: boolean };
type Ocupacion = { horario_id: string; actividad: string; emoji: string | null; dia_semana: number; hora: string; cupo: number | null; clases: number; anotados: number | null; vinieron: number | null; porcentaje: number | null };
const DIA = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default async function PaginaGrilla() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "clases");
    exigirRol(panel, ["dueno", "encargado", "recepcion", "profe"]);
    // VD-60 (D34): la recepción y el profe ven la grilla; armarla y ver la ocupación y el equipo es del dueño y el encargado.
    const gestiona = ["dueno", "encargado"].includes(panel.yo.rol);
    const [actividades, horarios, equipo, ocupacion] = await Promise.all([
      rpc<Actividad[]>("actividades_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<Horario[]>("horarios_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      gestiona ? rpc<Miembro[]>("equipo_gimnasio", { p_gimnasio_id: panel.gimnasio.id }) : Promise.resolve<Miembro[]>([]),
      // CLA-5: cuánto se llenó cada horario en las últimas 4 semanas.
      gestiona ? rpc<Ocupacion[]>("ocupacion_horarios", { p_gimnasio_id: panel.gimnasio.id, p_semanas: 4 }) : Promise.resolve<Ocupacion[]>([]),
    ]);
    const conDatos = ocupacion.filter((o) => o.clases > 0);
    return (
      <>
        <Link href="/panel/clases" className="texto-suave hover:text-[var(--texto)]">← Clases</Link>
        <div className="mt-4"><Encabezado icono="grilla" titulo="Grilla" bajada={gestiona ? "Las actividades y en qué horarios se dan. Las clases de cada día salen de acá." : "Las actividades y en qué horarios se dan. La arma el dueño o el encargado."} /></div>
        <Grilla soloLectura={!gestiona} hoy={new Intl.DateTimeFormat("en-CA", { timeZone: panel.gimnasio.zona_horaria }).format(new Date())} actividades={actividades} horarios={horarios} sedes={panel.sedes.map((s) => ({ id: s.id, nombre: s.nombre }))}
          profes={equipo.filter((e) => e.activo).map((e) => ({ id: e.equipo_id, nombre: e.nombre }))} />
        {conDatos.length > 0 && (
          <section className="mt-12" aria-labelledby="ocupacion" data-ocupacion>
            <h2 id="ocupacion" className="titulo text-3xl mb-1"><Icono nombre="grafico" /> Ocupación</h2>
            <p className="texto-suave mb-4">Cuántos vinieron, en promedio, en las últimas 4 semanas. Para decidir qué horario sumar o sacar.</p>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {conDatos.map((o) => {
                const p = o.porcentaje;
                return (
                  <li key={o.horario_id} className="tarjeta px-4 py-3 flex items-center gap-3"
                    style={p != null ? { background: `color-mix(in oklab, var(--acento) ${Math.min(Math.max(p, 0), 100) * 0.45}%, var(--tarjeta))` } : undefined}>
                    <span className="numero text-lg w-20">{DIA[o.dia_semana]} {o.hora}</span>
                    <span className="flex-1 min-w-0 truncate"><Icono nombre={o.emoji ?? "calendario"} /> {o.actividad}</span>
                    <span className="numero text-lg" title={`${o.clases} clases`}>{p != null ? `${p}%` : `${o.vinieron ?? 0} p/clase`}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </>
    );
  });
}
