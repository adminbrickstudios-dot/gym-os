import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { Vacio } from "@/components/ui/Vacio";
import { detalleControl, enlaceControl, META_TIPO, TIPOS_CONTROL, tituloControl, type ItemControl, type PaginaControl } from "@/lib/control";
import { intentar } from "@/lib/panel/intentar";
import { ErrorDatos, contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { FiltrosControl, type PersonaControl } from "./FiltrosControl";

export const metadata: Metadata = { title: "Control" };

type Pedido = { tipos?: string | string[]; desde?: string; hasta?: string; quien?: string; cursor?: string };
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POR_PAGINA = 40;
const sumar = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** VD-10: todo queda escrito. La línea de tiempo del dueño, de los hechos que ya se guardan (nada se guarda aparte). */
export default async function Control({ searchParams }: { searchParams: Promise<Pedido> }) {
  const sp = await searchParams;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado"]);
    if (panel.yo.rol === "encargado" && !panel.permisos.encargado_ve_resultado) {
      throw new ErrorDatos("El dueño no le dio acceso al Control al encargado: lo prende en Equipo → Permisos.", "42501", 403);
    }
    exigirSeccion(panel, "control");
    const zona = panel.gimnasio.zona_horaria;
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date());
    const tipos = (Array.isArray(sp.tipos) ? sp.tipos : [sp.tipos ?? ""]).flatMap((t) => t.split(",")).filter((t) => (TIPOS_CONTROL as readonly string[]).includes(t));
    let hasta = FECHA.test(sp.hasta ?? "") && sp.hasta! <= hoy ? sp.hasta! : hoy;
    let desde = FECHA.test(sp.desde ?? "") ? sp.desde! : sumar(hasta, -6);
    if (desde > hasta) [desde, hasta] = [hasta, desde];
    if (Date.parse(hasta) - Date.parse(desde) > 365 * 864e5) desde = sumar(hasta, -365);
    const quien = UUID.test(sp.quien ?? "") ? sp.quien! : "";
    const cursor = sp.cursor && sp.cursor.includes("|") && sp.cursor.length < 200 ? sp.cursor : null;

    const [pagina, equipo] = await Promise.all([
      rpc<PaginaControl>("linea_de_control", {
        p_gimnasio_id: panel.gimnasio.id, p_desde: desde, p_hasta: hasta, p_tipos: tipos.length ? tipos : null,
        p_quien: quien || null, p_limite: POR_PAGINA, p_cursor: cursor,
      }),
      rpc<(PersonaControl & { activo: boolean })[]>("equipo_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
    ]);

    const filtros = new URLSearchParams();
    tipos.forEach((t) => filtros.append("tipos", t));
    filtros.set("desde", desde); filtros.set("hasta", hasta);
    if (quien) filtros.set("quien", quien);
    const base = filtros.toString();
    const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    const dia = (m: string) => new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date(m));
    const titulo = (d: string) => (d === hoy ? "Hoy" : d === sumar(hoy, -1) ? "Ayer" : new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`)));

    const porDia = new Map<string, ItemControl[]>();
    for (const i of pagina.items) porDia.set(dia(i.en), [...(porDia.get(dia(i.en)) ?? []), i]);

    return (
      <>
        <Encabezado emoji="🛡️" titulo="Control" bajada="Todo queda escrito: quién hizo qué y cuándo. Nada se borra; anular es un hecho nuevo."
          accion={<a href={`/panel/control/exportar?${base}`} className="boton" data-exportar-control>⬇️ Exportar a Excel</a>} />
        <div className="space-y-6">
          <FiltrosControl key={base} personas={equipo.map((p) => ({ equipo_id: p.equipo_id, nombre: p.nombre }))} tipos={tipos} quien={quien} desde={desde} hasta={hasta} hoy={hoy} />
          <p className="texto-suave flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
            <Link href="/panel/entrada/control" className="underline">🔎 Control de la puerta</Link>
            <Link href="/panel/equipo/actividad" className="underline">📋 Qué hizo cada uno</Link>
          </p>
          {pagina.items.length === 0 ? (
            <Vacio emoji={cursor ? "🏁" : "🌿"} titulo={cursor ? "No hay más movimientos" : "Nada para mostrar con estos filtros"}
              acciones={<Link href={cursor ? `/panel/control?${base}` : "/panel/control"} className="boton">{cursor ? "Volver al principio" : "Ver los últimos 7 días"}</Link>}>
              {cursor ? "Ya viste todo lo que hay en estas fechas." : "Cuando alguien cobre, anule, dé un descuento o cierre la caja, queda escrito acá."}
            </Vacio>
          ) : (
            <div className="space-y-8" data-linea-control>
              {[...porDia.entries()].map(([d, items]) => (
                <section key={d} aria-label={titulo(d)}>
                  <h2 className="titulo-grupo first-letter:uppercase mb-2">{titulo(d)}</h2>
                  <ul className="space-y-2">
                    {items.map((i) => {
                      const enlace = enlaceControl(i);
                      const cuerpo = (
                        <>
                          <span className="icono" aria-hidden>{META_TIPO[i.tipo].emoji}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold leading-tight break-words">{tituloControl(i, zona)}</span>
                            {detalleControl(i) && <span className="block texto-suave text-[15px] break-words">{detalleControl(i)}</span>}
                          </span>
                          <span className="numero texto-tenue text-sm flex-none">{hora(i.en)}</span>
                        </>
                      );
                      return (
                        <li key={i.clave} data-control-item={i.tipo}>
                          {enlace
                            ? <Link href={enlace} className="tarjeta fila flex items-center gap-3 px-4 py-3 min-h-[60px] hover:bg-[var(--tarjeta-alta)] transition-colors">{cuerpo}</Link>
                            : <div className="tarjeta flex items-center gap-3 px-4 py-3 min-h-[60px]">{cuerpo}</div>}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              <nav className="flex flex-wrap gap-2" aria-label="Páginas">
                {cursor && <Link href={`/panel/control?${base}`} className="boton">← Al principio</Link>}
                {pagina.siguiente && <Link href={`/panel/control?${base}&cursor=${encodeURIComponent(pagina.siguiente)}`} className="boton" data-mas-control>Más viejos →</Link>}
              </nav>
            </div>
          )}
        </div>
      </>
    );
  });
}
