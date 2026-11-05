import { LinkPanel } from "@/components/panel/LinkPanel";
import { linkWhatsappSocio } from "@/lib/whatsapp";
import Link from "next/link";
import { GrillaAccesos } from "@/components/panel/GrillaAccesos";
import { PrimerosPasos, type PrimerosPasosDatos } from "@/components/panel/PrimerosPasos";
import { fechaLarga, formatearNumero, formatearPesos, saludo } from "@/lib/formato";
import { accesosDisponibles, accesosElegidos, rutaDisponible } from "@/lib/panel/secciones";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, rpc } from "@/lib/panel/servidor";
import { FilaVenta } from "@/components/panel/Venta";
import { AlertasCaja, type AlertaCaja } from "@/components/panel/AlertasCaja";
import type { Venta } from "./ventas-acciones";

type Numero = { clave: string; emoji: string; etiqueta: string; valor: number; formato?: "pesos" };
type Ahora = { tipo: string; emoji: string; titulo: string; detalle?: string; hora?: string; href?: string; tono?: string };
type Inicio = { hoy: string; numeros: Numero[]; ahora: Ahora[] };
const DETALLE: Record<string, { ruta: string; seccion: string }> = {
  entraron: { ruta: "/panel/entrada", seccion: "entrada" },
  cobrado: { ruta: "/panel/caja", seccion: "caja" },
  vencen: { ruta: "/panel/vencen-hoy", seccion: "vencen_hoy" },
  al_dia: { ruta: "/panel/socios", seccion: "socios" },
  por_aprobar: { ruta: "/panel/transferencias", seccion: "transferencias" },
  mis_clases: { ruta: "/panel/clases", seccion: "clases" },
  anotados: { ruta: "/panel/clases", seccion: "clases" },
  presentes: { ruta: "/panel/clases", seccion: "clases" },
  faltan: { ruta: "/panel/clases", seccion: "clases" },
  clases: { ruta: "/panel/clases", seccion: "clases" },
};

// Las rutas que devuelve la base son relativas al panel.
const enPanel = (href?: string) => (href ? `/panel${href}` : undefined);

type Cumple = { socio_id: string; nombre: string; telefono: string | null; cumple: number; mensaje: string };
type InvitadoHoy = { id: string; nombre: string; socio: string; entro_en: string | null };
type Dejado = { ingreso_id: string; momento: string; socio_id: string; socio: string; por: string | null; motivo: string; porque_no: string };
type PedidoPausa = { id: string; socio_id: string; nombre: string; desde: string; vuelve: string; categoria: string };
const diaCorto = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

export default async function Inicio() {
  return intentar(async () => {
    const panel = await contextoPanel();
    const { rol } = panel.yo;
    const [datos, pasos, cumples, pedidosPausa, dejados, invitados, anular, stock, productos, alertasCaja] = await Promise.all([
      rpc<Inicio>("panel_inicio", { p_gimnasio_id: panel.gimnasio.id }),
      // Solo el dueño arma el gimnasio: los demás roles no ven (ni piden) los primeros pasos.
      rol === "dueno" ? rpc<PrimerosPasosDatos>("primeros_pasos", { p_gimnasio_id: panel.gimnasio.id }) : null,
      rol === "profe" ? [] : rpc<Cumple[]>("cumplen_hoy", { p_gimnasio_id: panel.gimnasio.id }),
      // Las pausas que pidió la recepción esperan al dueño o al encargado.
      rol === "dueno" || rol === "encargado" ? rpc<PedidoPausa[]>("pedidos_pausa_pendientes", { p_gimnasio_id: panel.gimnasio.id }) : [],
      // D1: cada "dejar pasar" de hoy, a la vista del dueño y del encargado.
      rol === "dueno" || rol === "encargado" ? rpc<Dejado[]>("dejados_pasar", { p_gimnasio_id: panel.gimnasio.id }) : [],
      // INV-1: los invitados de hoy, en el resumen del dueño.
      rol === "dueno" || rol === "encargado" ? rpc<InvitadoHoy[]>("invitados_de_hoy", { p_gimnasio_id: panel.gimnasio.id }) : [],
      // VEN-6: ventas que la recepción pidió anular.
      rol === "dueno" || rol === "encargado" ? rpc<Venta[]>("pedidos_anulacion_pendientes", { p_gimnasio_id: panel.gimnasio.id }) : [],
      // VEN-4: productos que llegaron a su mínimo.
      rol === "dueno" || rol === "encargado" ? rpc<Record<string, { stock: number; minimo: number | null }>>("stock_productos", { p_gimnasio_id: panel.gimnasio.id })
        : ({} as Record<string, { stock: number; minimo: number | null }>),
      rol === "dueno" || rol === "encargado" ? rpc<{ producto_id: string; nombre: string; activo: boolean }[]>("productos_gimnasio", { p_gimnasio_id: panel.gimnasio.id }) : [],
      // CAJ-4: lo que pasó con la plata (de otros), si hay Caja.
      (rol === "dueno" || rol === "encargado") && !panel.secciones_apagadas.includes("caja") ? rpc<AlertaCaja[]>("alertas_caja", { p_gimnasio_id: panel.gimnasio.id, p_dias: 7 }) : [],
    ]);
    const reponer = productos.filter((p) => p.activo && stock[p.producto_id] && (stock[p.producto_id].stock <= 0
      || (stock[p.producto_id].minimo != null && stock[p.producto_id].stock <= stock[p.producto_id].minimo!)));
    const { elegidos, perdidos } = accesosElegidos(rol, panel.secciones_apagadas, panel.yo.accesos);
    const zona = panel.gimnasio.zona_horaria;
    // Lo que lleva a una pantalla apagada (o que el rol no ve) no se muestra: no hay a dónde ir.
    const ahora = datos.ahora.filter((a) => !a.href || rutaDisponible(`/panel${a.href}`, rol, panel.secciones_apagadas));

    return (
      <div className="space-y-10 sm:space-y-12">
        <header>
          <h1 className="titular text-5xl sm:text-7xl">{saludo(new Date(), zona)}, {panel.yo.nombre} 👋</h1>
          <p className="texto-suave text-lg mt-3 first-letter:uppercase">{fechaLarga(new Date(), zona)} · {panel.gimnasio.nombre}</p>
        </header>

        {pasos && <PrimerosPasos datos={pasos} />}

        <GrillaAccesos elegidos={elegidos} disponibles={accesosDisponibles(rol, panel.secciones_apagadas)} perdidos={perdidos} />

        <section aria-label="Números de hoy">
          <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8">
            {datos.numeros.map((n) => {
              const cuerpo = (
                <>
                  <dt className="texto-suave mt-2 text-[15px]"><span aria-hidden>{n.emoji}</span> {n.etiqueta}</dt>
                  <dd className="numero text-5xl sm:text-6xl">{n.formato === "pesos" ? formatearPesos(n.valor) : formatearNumero(n.valor)}</dd>
                </>
              );
              // Cada número lleva a su detalle (si la sección está prendida).
              const href = DETALLE[n.clave];
              return href && !panel.secciones_apagadas.includes(href.seccion)
                ? <Link key={n.clave} href={href.ruta} className="flex flex-col-reverse rounded-2xl p-2 -m-2 hover:bg-[var(--tarjeta)] active:scale-[0.98] transition">{cuerpo}</Link>
                : <div key={n.clave} className="flex flex-col-reverse">{cuerpo}</div>;
            })}
          </dl>
        </section>

        <section aria-labelledby="ahora">
          <h2 id="ahora" className="titulo text-3xl mb-4">Ahora y lo que sigue</h2>
          {ahora.length === 0 ? (
            <p className="texto-suave text-lg">Nada pendiente por ahora. ✨</p>
          ) : (
            <ul className="space-y-2">
              {ahora.map((a, i) => {
                const contenido = (
                  <>
                    <span className="icono" aria-hidden>{a.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-lg leading-tight">{a.titulo}</span>
                      {a.detalle && <span className="block texto-suave text-[15px] truncate">{a.detalle}</span>}
                    </span>
                    {a.hora && <span className="numero text-2xl">{a.hora}</span>}
                    {a.tono && !a.hora && <span className="size-2.5 rounded-full" style={{ background: `var(--${a.tono})` }} aria-hidden />}
                  </>
                );
                const clase = "tarjeta flex items-center gap-4 px-4 py-3 min-h-[68px]";
                const href = enPanel(a.href);
                return (
                  <li key={`${a.tipo}-${i}`}>
                    {href ? <Link href={href} className={`${clase} hover:bg-[var(--tarjeta-alta)] transition-colors`}>{contenido}</Link> : <div className={clase}>{contenido}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {dejados.length > 0 && (
          <section aria-labelledby="dejados" data-dejados-pasar={dejados.length}>
            <h2 id="dejados" className="titulo text-3xl mb-1">🚪 Dejados pasar hoy</h2>
            <p className="texto-suave mb-4">Entraron sin poder: quién los dejó y por qué. <LinkPanel href="/panel/entrada/control" siNoEsta="texto" className="underline">Ver la semana</LinkPanel></p>
            <ul className="space-y-2">
              {dejados.map((x) => (
                <li key={x.ingreso_id}>
                  <LinkPanel href={`/panel/socios/${x.socio_id}`} siNoEsta="texto" className="tarjeta fila flex items-center gap-3 px-4 py-3 min-h-[68px]">
                    <span className="numero text-lg texto-suave w-12 flex-none">{new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(x.momento))}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-lg truncate">{x.socio}</span>
                      <span className="block texto-suave truncate">{x.por ?? "El equipo"}: “{x.motivo}” · {x.porque_no}</span>
                    </span>
                  </LinkPanel>
                </li>
              ))}
            </ul>
          </section>
        )}

        {invitados.length > 0 && (
          <section aria-labelledby="invitados-hoy" data-invitados-hoy={invitados.length}>
            <h2 id="invitados-hoy" className="titulo text-3xl mb-4">👥 Invitados hoy</h2>
            <ul className="space-y-1">
              {invitados.map((i) => <li key={i.id} className="texto-suave">{i.entro_en ? "✅" : "⏳"} <span className="text-[var(--texto)] font-semibold">{i.nombre}</span>, invitado por {i.socio}</li>)}
            </ul>
          </section>
        )}

        {alertasCaja.length > 0 && <AlertasCaja alertas={alertasCaja} zona={zona} />}

        {reponer.length > 0 && rutaDisponible("/panel/planes", rol, panel.secciones_apagadas) && (
          <section aria-labelledby="reponer" data-reponer={reponer.length}>
            <h2 id="reponer" className="titulo text-3xl mb-4">📦 Por reponer</h2>
            <ul className="flex flex-wrap gap-2">
              {reponer.map((p) => (
                <li key={p.producto_id}>
                  <LinkPanel href="/panel/planes" siNoEsta="texto" className="pildora pildora-amarillo !text-base !px-4 !py-2">{p.nombre}: {stock[p.producto_id].stock <= 0 ? "sin stock" : `quedan ${stock[p.producto_id].stock}`}</LinkPanel>
                </li>
              ))}
            </ul>
          </section>
        )}

        {anular.length > 0 && (
          <section aria-labelledby="pedidos-anulacion" data-pedidos-anulacion={anular.length}>
            <h2 id="pedidos-anulacion" className="titulo text-3xl mb-4">↩️ Ventas para anular</h2>
            <ul className="space-y-2">{anular.map((v) => <FilaVenta key={v.venta_id} v={v} zona={zona} conSocio />)}</ul>
          </section>
        )}

        {pedidosPausa.length > 0 && (
          <section aria-labelledby="pedidos-pausa" data-pedidos-pausa={pedidosPausa.length}>
            <h2 id="pedidos-pausa" className="titulo text-3xl mb-4">⏸️ Pausas para aprobar</h2>
            <ul className="space-y-2">
              {pedidosPausa.map((x) => (
                <li key={x.id}>
                  <LinkPanel href={`/panel/socios/${x.socio_id}`} siNoEsta="texto" className="tarjeta fila flex items-center gap-3 px-4 py-3 min-h-[68px]">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-lg truncate">{x.nombre}</span>
                      <span className="block texto-suave">Del {diaCorto(x.desde)}, vuelve el {diaCorto(x.vuelve)} · {x.categoria}</span>
                    </span>
                    <span className="texto-suave">Revisar</span>
                  </LinkPanel>
                </li>
              ))}
            </ul>
          </section>
        )}

        {cumples.length > 0 && (
          <section aria-labelledby="cumples" data-cumplen-hoy={cumples.length}>
            <h2 id="cumples" className="titulo text-3xl mb-4">🎂 Cumplen hoy</h2>
            <ul className="space-y-2">
              {cumples.map((c) => {
                const wa = linkWhatsappSocio(c.telefono, c.mensaje);
                return (
                  <li key={c.socio_id} className="tarjeta flex flex-wrap items-center gap-3 px-4 py-3 min-h-[68px]">
                    <span className="text-2xl" aria-hidden>🎉</span>
                    <span className="min-w-0 flex-1">
                      <LinkPanel href={`/panel/socios/${c.socio_id}`} siNoEsta="texto" className="block font-semibold text-lg truncate">{c.nombre}</LinkPanel>
                      <span className="block texto-suave">Cumple {c.cumple}</span>
                    </span>
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="boton">💬 Saludar</a>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    );
  });
}
