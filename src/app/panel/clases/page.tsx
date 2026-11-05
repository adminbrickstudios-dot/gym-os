import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { SelectorSede } from "@/components/panel/SelectorSede";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { sedeActiva } from "@/lib/panel/sede";
import { Vacio } from "@/components/ui/Vacio";

export const metadata: Metadata = { title: "Clases" };
type Clase = { clase_id: string; actividad: string; emoji: string | null; color: string | null; inicio: string; fin: string; profe: string | null;
  cupo: number | null; confirmadas: number; en_espera: number; cancelada: boolean; cancelada_motivo: string | null };

function diaLocal(zona: string, sumar = 0) {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date());
  const d = new Date(`${hoy}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + sumar);
  return d.toISOString().slice(0, 10);
}

export default async function Clases({ searchParams }: { searchParams: Promise<{ dia?: string; sede?: string }> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirSeccion(panel, "clases");
    const zona = panel.gimnasio.zona_horaria;
    const { sede, puedeCambiar } = sedeActiva(panel, sp.sede);
    const dias = Array.from({ length: 7 }, (_, i) => diaLocal(zona, i));
    const dia = dias.includes(sp.dia ?? "") ? sp.dia! : dias[0];
    const clases = await rpc<Clase[]>("clases_del_dia", { p_sede_id: sede.id, p_dia: dia });
    const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    const nombreDia = (d: string, i: number) => (i === 0 ? "Hoy" : i === 1 ? "Mañana" : new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`)));
    const ahora = Date.now();
    return (
      <>
        <Encabezado emoji="🗓️" titulo="Clases" bajada={panel.modo_clases === "reserva" ? "Cupos, reservas y lista de espera. Tocá una clase para tomar presente." : "Tocá una clase para tomar presente."}
          accion={["dueno", "encargado"].includes(panel.yo.rol) ? <Link href="/panel/clases/grilla" className="boton">🧩 Armar la grilla</Link> : undefined} />
        {puedeCambiar && <SelectorSede sedes={panel.sedes} actual={sede.id} ruta="/panel/clases" />}
        <nav aria-label="Día" className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-4 px-4">
          {dias.map((d, i) => (
            <Link key={d} href={`/panel/clases?dia=${d}${sp.sede ? `&sede=${sp.sede}` : ""}`} aria-current={d === dia ? "page" : undefined}
              className={`boton !min-h-12 whitespace-nowrap first-letter:uppercase ${d === dia ? "!border-[var(--acento)]" : "opacity-75"}`}>{nombreDia(d, i)}</Link>
          ))}
        </nav>
        {clases.length === 0 ? <Vacio emoji="🗓️" titulo="No hay clases este día">Las clases salen de la grilla de la semana. Si hoy tendría que haber, revisá la grilla.</Vacio> : (
          <ul className="space-y-2">
            {clases.map((c) => {
              const lleno = c.cupo != null && c.confirmadas >= c.cupo;
              const pasada = new Date(c.fin).getTime() < ahora;
              // REV-4: el profe ve toda la grilla del día, pero solo abre la lista de sus clases (la base no le deja ver las otras).
              const ajena = panel.yo.rol === "profe" && c.profe !== panel.yo.nombre;
              const estilo = `tarjeta flex items-center gap-4 px-4 py-4 ${ajena ? "" : "hover:bg-[var(--tarjeta-alta)]"} ${c.cancelada || pasada || ajena ? "opacity-55" : ""}`;
              const contenido = (
                <>
                    <span className="numero text-3xl w-20">{hora(c.inicio)}</span>
                    <span className="icono" aria-hidden>{c.emoji ?? "🗓️"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-lg truncate">{c.actividad}</span>
                      <span className="block texto-suave truncate">{c.cancelada ? `Cancelada · ${c.cancelada_motivo ?? ""}` : c.profe ?? "Sin profe asignado"}</span>
                    </span>
                    {!c.cancelada && (
                      <span className={`pildora ${lleno ? "pildora-rojo" : ""}`}>
                        {c.confirmadas}{c.cupo != null ? `/${c.cupo}` : ""}{c.en_espera ? ` · ${c.en_espera} en espera` : ""}
                      </span>
                    )}
                </>
              );
              return (
                <li key={c.clase_id}>
                  {ajena
                    ? <div className={estilo} data-clase-ajena>{contenido}</div>
                    : <Link href={`/panel/clases/${c.clase_id}`} className={estilo}>{contenido}</Link>}
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  });
}
