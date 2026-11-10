import type { Metadata } from "next";
import Link from "next/link";
import { ActivarPush } from "@/components/ActivarPush";
import { Encabezado } from "@/components/panel/Marco";
import { Vacio } from "@/components/ui/Vacio";
import { intentar } from "@/lib/panel/intentar";
import { traerCampana, traerPreferencias, type ItemCampana } from "./datos";
import { MarcarTodo, PreferenciasAvisos } from "./Controles";
import { MarcarLeidos } from "./Leidos";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "Novedades" };

/** Tipos de aviso que justifican ofrecer el aviso al celular: lo que se pierde si nadie lo mira a tiempo. */
const JUSTIFICAN_PUSH = new Set(["comprobantes", "caja", "pedidos"]);

/** AVI-5 / VD-37: lo que pasó y te toca ver, agrupado por día, con el link a lo que hay que hacer. Se calcula al abrirla. */
export default async function Novedades() {
  return intentar(async () => {
    const { panel, items, sinLeer } = await traerCampana();
    const prefs = await traerPreferencias();
    const zona = panel.gimnasio.zona_horaria;
    const dia = (m: string) => new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(m));
    const hoy = dia(new Date().toISOString());
    const ayer = dia(new Date(Date.now() - 86_400_000).toISOString());
    const etiqueta = (d: string, m: string) => d === hoy ? "Hoy" : d === ayer ? "Ayer"
      : new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "long", day: "numeric", month: "long" }).format(new Date(m));
    const hora = (m: string | null) => (m ? new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m)) : null);

    // Agrupadas por día (la base ya las manda de la más nueva a la más vieja). Lo que no tiene fecha es un estado de ahora.
    const grupos: { clave: string; titulo: string; items: ItemCampana[] }[] = [];
    for (const i of items) {
      const d = i.en ? dia(i.en) : "ahora";
      let g = grupos.find((x) => x.clave === d);
      if (!g) { g = { clave: d, titulo: i.en ? etiqueta(d, i.en) : "Para atender ahora", items: [] }; grupos.push(g); }
      g.items.push(i);
    }
    grupos.sort((a, b) => (a.clave === "ahora" ? -1 : 0) - (b.clave === "ahora" ? -1 : 0));
    const fila = (i: ItemCampana) => (
      <li key={i.clave} data-novedad={i.leido ? "vista" : "nueva"} data-tipo={i.tipo ?? ""}>
        <Link href={i.href} className={`tarjeta fila flex items-center gap-4 px-4 py-3 min-h-[68px] hover:bg-[var(--tarjeta-alta)] transition-colors ${i.leido ? "opacity-70" : ""}`}>
          <span className="icono" aria-hidden><Icono nombre={i.emoji} /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-lg leading-tight">{i.titulo}</span>
            {i.detalle && <span className="block texto-suave text-[15px] truncate">{i.detalle}</span>}
          </span>
          <span className="flex-none text-right">
            {!i.leido && <span className="pildora !text-xs block mb-0.5">Nuevo</span>}
            {hora(i.en) && <span className="text-sm texto-tenue">{hora(i.en)}</span>}
          </span>
        </Link>
      </li>
    );
    const hayParaPush = items.some((i) => !i.leido && JUSTIFICAN_PUSH.has(i.tipo ?? "")) && panel.yo.rol !== "profe";
    return (
      <>
        <Encabezado icono="campana" titulo="Novedades" bajada={sinLeer ? `${sinLeer === 1 ? "1 cosa nueva" : `${sinLeer} cosas nuevas`} desde la última vez. Tocá cada una para ir a resolverla.` : "Lo que pasó en el gimnasio y te toca ver."} />
        <MarcarLeidos claves={items.filter((i) => !i.leido).map((i) => i.clave)} />
        <MarcarTodo sinLeer={sinLeer} />
        {items.length === 0 ? <Vacio icono="estrella" titulo="Nada nuevo">Cuando llegue un comprobante, alguien pida algo o pase algo con la plata, aparece acá.</Vacio> : (
          <div className="space-y-10" data-grupos-dia>
            {grupos.map((g) => (
              <section key={g.clave} data-dia={g.clave}>
                <h2 className="titulo text-2xl mb-3 first-letter:uppercase">{g.titulo}</h2>
                <ul className="space-y-2">{g.items.map(fila)}</ul>
              </section>
            ))}
          </div>
        )}

        {/* Pedir permiso para el push SOLO después de algo que lo justifique: acá ya vio algo que se pierde si no lo mira a tiempo. */}
        {hayParaPush && (
          <section className="tarjeta p-5 sm:p-6 max-w-xl mt-10" data-push-oferta aria-labelledby="oferta-push">
            <h2 id="oferta-push" className="titulo text-2xl mb-1"><Icono nombre="celular" /> ¿Te avisamos al celular?</h2>
            <p className="texto-suave mb-4">Así no te enterás tarde la próxima vez que llegue un comprobante o se pida algo. Lo activás en este dispositivo y lo apagás cuando quieras.</p>
            <ActivarPush />
          </section>
        )}

        {prefs.length > 0 && (
          <details className="mt-10 max-w-2xl" data-preferencias-avisos>
            <summary className="boton cursor-pointer inline-flex"><Icono nombre="ajustes" /> Qué avisos querés ver</summary>
            <div className="mt-4">
              <p className="texto-suave mb-3">Apagar un tipo lo saca de esta lista y del número de la campana. Lo que pasó queda registrado igual. Los avisos al celular se eligen por dispositivo en <Link href="/panel/cuenta" className="underline">Mi cuenta</Link>.</p>
              <PreferenciasAvisos inicial={prefs} />
            </div>
          </details>
        )}
      </>
    );
  });
}
