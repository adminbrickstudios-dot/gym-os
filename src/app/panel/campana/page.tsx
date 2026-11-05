import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { Vacio } from "@/components/ui/Vacio";
import { intentar } from "@/lib/panel/intentar";
import { traerCampana, type ItemCampana } from "./datos";
import { MarcarLeidos } from "./Leidos";

export const metadata: Metadata = { title: "Novedades" };

/** AVI-5: lo que pasó y te toca ver, con el link a lo que hay que hacer. Se calcula al abrirla. */
export default async function Novedades() {
  return intentar(async () => {
    const { panel, items, sinLeer } = await traerCampana();
    const zona = panel.gimnasio.zona_horaria;
    const cuando = (m: string | null) => (m ? new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m)) : null);
    const nuevos = items.filter((i) => !i.leido);
    const vistos = items.filter((i) => i.leido);
    const fila = (i: ItemCampana) => (
      <li key={i.clave} data-novedad={i.leido ? "vista" : "nueva"}>
        <Link href={i.href} className="tarjeta fila flex items-center gap-4 px-4 py-3 min-h-[68px] hover:bg-[var(--tarjeta-alta)] transition-colors">
          <span className="icono" aria-hidden>{i.emoji}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-lg leading-tight">{i.titulo}</span>
            {i.detalle && <span className="block texto-suave text-[15px] truncate">{i.detalle}</span>}
          </span>
          {cuando(i.en) && <span className="text-sm texto-tenue flex-none first-letter:uppercase">{cuando(i.en)}</span>}
        </Link>
      </li>
    );
    return (
      <>
        <Encabezado emoji="🔔" titulo="Novedades" bajada={sinLeer ? `${sinLeer === 1 ? "1 cosa nueva" : `${sinLeer} cosas nuevas`} desde la última vez. Tocá cada una para ir a resolverla.` : "Lo que pasó en el gimnasio y te toca ver."} />
        <MarcarLeidos claves={nuevos.map((i) => i.clave)} />
        {items.length === 0 ? <Vacio emoji="✨" titulo="Nada nuevo">Cuando llegue un comprobante, alguien pida algo o pase algo con la plata, aparece acá.</Vacio> : (
          <div className="space-y-10">
            {nuevos.length > 0 && <section><h2 className="titulo text-2xl mb-3">Nuevo</h2><ul className="space-y-2">{nuevos.map(fila)}</ul></section>}
            {vistos.length > 0 && <section><h2 className="titulo text-2xl mb-3 texto-suave">Ya visto</h2><ul className="space-y-2 opacity-70">{vistos.map(fila)}</ul></section>}
          </div>
        )}
      </>
    );
  });
}
