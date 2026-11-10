import { NovedadesGymOS, type NovedadGymOS } from "@/components/panel/NovedadesGymOS";
import { BotonEntrada } from "@/components/panel/BotonEntrada";
import { BotonFichar } from "@/components/panel/BotonFichar";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { linkWhatsappSocio } from "@/lib/whatsapp";
import Link from "next/link";
import { Suspense } from "react";
import { GrillaAccesos } from "@/components/panel/GrillaAccesos";
import { PrimerosPasos, type PrimerosPasosDatos } from "@/components/panel/PrimerosPasos";
import { DatosEjemploInicio } from "@/components/panel/DatosEjemploInicio";
import { SeguridadDueno } from "@/components/panel/SeguridadDueno";
import { fechaLarga, saludo } from "@/lib/formato";
import { NumerosInicio, type NumeroInicio } from "@/components/panel/NumerosInicio";
import { ElegirNumeros } from "@/components/panel/ElegirNumeros";
import { accesosDisponibles, accesosElegidos, rutaDisponible } from "@/lib/panel/secciones";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, rpcLectura, type PanelGimnasio } from "@/lib/panel/servidor";
import { FilaVenta } from "@/components/panel/Venta";
import { AlertasCaja, type AlertaCaja } from "@/components/panel/AlertasCaja";
import type { Venta } from "./ventas-acciones";
import { FilaTarea, type Tarea } from "./tareas/Tareas";
import { UltimasEntradas, type EntradaVivo } from "@/components/panel/UltimasEntradas";
import { FueraDeServicio, type MaquinaFuera } from "@/components/panel/FueraDeServicio";
import { LockersVencen, type LockerVence } from "@/components/panel/LockersVencen";
import { Icono } from "@/components/ui/Icono";

// VD-12b: lo que hay para hacer hoy, calculado por la base (nada se guarda).
type ParaHacer = { clave: string; emoji: string; texto: string; cantidad: number; href: string };

type Ahora = { tipo: string; emoji: string; titulo: string; detalle?: string; hora?: string; href?: string; tono?: string };
type Inicio = { hoy: string; numeros: NumeroInicio[]; ahora: Ahora[] };
type MiFichaje = { usa: boolean; nombre: string; puede: boolean; en_turno: boolean; entrada_en: string | null; sin_salida_desde: string | null };
type NumerosElegidos = { numeros: NumeroInicio[]; elegidos: string[]; disponibles: { clave: string; emoji: string; etiqueta: string }[] };

// Las rutas que devuelve la base son relativas al panel.
const enPanel = (href?: string) => (href ? `/panel${href}` : undefined);

type Cumple = { socio_id: string; nombre: string; telefono: string | null; cumple: number; mensaje: string };
type InvitadoHoy = { id: string; nombre: string; socio: string; entro_en: string | null };
type Dejado = { ingreso_id: string; momento: string; socio_id: string; socio: string; por: string | null; motivo: string; porque_no: string; promete_el?: string | null; autorizo?: string | null };
type PedidoPausa = { id: string; socio_id: string; nombre: string; desde: string; vuelve: string; categoria: string };
type PedidoBaja = { pedido_id: string; socio_id: string; nombre: string; motivo: string; nota: string | null; pedido_en: string; codigo?: string; tarde?: boolean };
const MOTIVO_BAJA: Record<string, string> = { precio: "el precio", horario: "los horarios", mudanza: "se muda", otro_gimnasio: "otro gimnasio", sin_tiempo: "no tiene tiempo", insatisfecho: "no le gustó", otro: "otra cosa" };
const diaCorto = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

// VD-47: primero la estructura (saludo y accesos, que salen del contexto), después los números y las
// listas, que llegan en streaming con su esqueleto.
export default async function Inicio() {
  return intentar(async () => {
    const panel = await contextoPanel();
    const { rol } = panel.yo;
    const { elegidos, perdidos } = accesosElegidos(rol, panel.secciones_apagadas, panel.yo.accesos);
    const zona = panel.gimnasio.zona_horaria;
    return (
      <div className="space-y-10 sm:space-y-12">
        <header>
          <h1 className="titular text-5xl sm:text-7xl pr-14">{saludo(new Date(), zona)}, {panel.yo.nombre} <Icono nombre="salir" /></h1>
          <p className="texto-suave text-lg mt-3 first-letter:uppercase">{fechaLarga(new Date(), zona)} · {panel.gimnasio.nombre}</p>
        </header>

        {rol !== "profe" && rutaDisponible("/panel/entrada", rol, panel.secciones_apagadas) && (
          <BotonEntrada className="flex items-center justify-center gap-3 rounded-[var(--radio)] min-h-24 px-6 py-5 bg-[var(--verde)] text-white font-bold text-3xl sm:text-4xl active:scale-[0.99] transition" />
        )}

        <GrillaAccesos elegidos={elegidos} disponibles={accesosDisponibles(rol, panel.secciones_apagadas)} perdidos={perdidos} />

        <Suspense fallback={<EsqueletoBloques />}>
          <BloquesInicio panel={panel} />
        </Suspense>
      </div>
    );
  });
}

function EsqueletoBloques() {
  const bloque = "rounded-[var(--radio)] bg-[var(--tarjeta)] animate-pulse";
  return (
    <div className="space-y-10 sm:space-y-12" aria-busy="true" aria-label="Cargando">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${bloque} h-20`} />)}
      </div>
      <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className={`${bloque} h-[68px]`} />)}</div>
    </div>
  );
}

async function BloquesInicio({ panel }: { panel: PanelGimnasio }) {
  return intentar(async () => {
    const { rol } = panel.yo;
    const zona = panel.gimnasio.zona_horaria;
    const [datos, numerosElegidos, pasos, cumples, pedidosPausa, dejados, invitados, anular, stock, productos, alertasCaja, olvidadas, pedidosBaja, novedadesGymOS, tareas, paraHacer, entradasVivo, fichaje, maquinasFuera, lockersVencen] = await Promise.all([
      rpcLectura<Inicio>("panel_inicio", { p_gimnasio_id: panel.gimnasio.id }),
      // VD-12: los 4 números elegidos, en un solo viaje (el profe conserva los suyos de panel_inicio).
      rol !== "profe" ? rpcLectura<NumerosElegidos>("numeros_inicio", { p_gimnasio_id: panel.gimnasio.id }) : null,
      // Solo el dueño arma el gimnasio: los demás roles no ven (ni piden) los primeros pasos.
      rol === "dueno" ? rpcLectura<PrimerosPasosDatos>("primeros_pasos", { p_gimnasio_id: panel.gimnasio.id }) : null,
      rol === "profe" ? [] : rpcLectura<Cumple[]>("cumplen_hoy", { p_gimnasio_id: panel.gimnasio.id }),
      // Las pausas que pidió la recepción esperan al dueño o al encargado.
      rol === "dueno" || rol === "encargado" ? rpcLectura<PedidoPausa[]>("pedidos_pausa_pendientes", { p_gimnasio_id: panel.gimnasio.id }) : [],
      // D1: cada "dejar pasar" de hoy, a la vista del dueño y del encargado.
      rol === "dueno" || rol === "encargado" ? rpcLectura<Dejado[]>("dejados_pasar", { p_gimnasio_id: panel.gimnasio.id }) : [],
      // INV-1: los invitados de hoy, en el resumen del dueño.
      rol === "dueno" || rol === "encargado" ? rpcLectura<InvitadoHoy[]>("invitados_de_hoy", { p_gimnasio_id: panel.gimnasio.id }) : [],
      // VEN-6: ventas que la recepción pidió anular.
      rol === "dueno" || rol === "encargado" ? rpcLectura<Venta[]>("pedidos_anulacion_pendientes", { p_gimnasio_id: panel.gimnasio.id }) : [],
      // VEN-4: productos que llegaron a su mínimo.
      rol === "dueno" || rol === "encargado" ? rpcLectura<Record<string, { stock: number; minimo: number | null }>>("stock_productos", { p_gimnasio_id: panel.gimnasio.id })
        : ({} as Record<string, { stock: number; minimo: number | null }>),
      rol === "dueno" || rol === "encargado" ? rpcLectura<{ producto_id: string; nombre: string; activo: boolean }[]>("productos_gimnasio", { p_gimnasio_id: panel.gimnasio.id }) : [],
      // CAJ-4: lo que pasó con la plata (de otros), si hay Caja.
      (rol === "dueno" || rol === "encargado") && !panel.secciones_apagadas.includes("caja") ? rpcLectura<AlertaCaja[]>("alertas_caja", { p_gimnasio_id: panel.gimnasio.id, p_dias: 7 }) : [],
      // CAJ-5: cajas que quedaron abiertas (al dueño y al encargado todas; a la recepción las suyas).
      rol !== "profe" && !panel.secciones_apagadas.includes("caja") ? rpcLectura<{ turno_id: string; caja: string; abierto_en: string; abierto_por: string; mia: boolean }[]>("cajas_olvidadas", { p_gimnasio_id: panel.gimnasio.id }) : [],
      // AUD-14: los que pidieron la baja desde la app (APP-8).
      rol !== "profe" ? rpcLectura<PedidoBaja[]>("pedidos_baja_pendientes", { p_gimnasio_id: panel.gimnasio.id }) : [],
      // ADM-6: lo que cuenta BRIK a los dueños.
      rol === "dueno" ? rpcLectura<NovedadGymOS[]>("novedades_dueno", { p_gimnasio_id: panel.gimnasio.id }).catch(() => []) : [],
      // COM-4: las tareas de hoy y las atrasadas de quien mira.
      rpcLectura<{ hoy: string; tareas: Tarea[] }>("tareas_panel", { p_gimnasio_id: panel.gimnasio.id }),
      // VD-12b: Para hacer hoy y las últimas entradas (el profe no las ve: su Inicio es el de sus clases).
      rol !== "profe" ? rpcLectura<ParaHacer[]>("para_hacer_hoy", { p_gimnasio_id: panel.gimnasio.id }) : [],
      rol !== "profe" ? rpcLectura<EntradaVivo[]>("ultimas_entradas", { p_gimnasio_id: panel.gimnasio.id, p_limite: 8 }) : [],
      // VD-53: el botón de fichar, solo si el gimnasio usa fichaje y esta persona ficha.
      rutaDisponible("/panel/fichar", rol, panel.secciones_apagadas) ? rpcLectura<MiFichaje>("mi_fichaje", { p_gimnasio_id: panel.gimnasio.id }) : null,
      // VD-54: las máquinas fuera de servicio hoy (dueño, encargado y recepción; la base devuelve vacío con la sección apagada).
      rol !== "profe" && !panel.secciones_apagadas.includes("maquinas") ? rpcLectura<MaquinaFuera[]>("maquinas_fuera_de_servicio", { p_gimnasio_id: panel.gimnasio.id }) : [],
      // VD-55: lockers que vencen esta semana (la base devuelve vacío con la sección apagada).
      rol !== "profe" && !panel.secciones_apagadas.includes("lockers") ? rpcLectura<LockerVence[]>("lockers_vencen_semana", { p_gimnasio_id: panel.gimnasio.id }) : [],
    ]);
    // Lo que lleva a una pantalla apagada (o que el rol no ve) no se muestra: no hay a dónde ir.
    const hacerHoy = paraHacer.filter((x) => rutaDisponible(`/panel${x.href}`, rol, panel.secciones_apagadas));
    const verEntradas = rol !== "profe" && rutaDisponible("/panel/entrada", rol, panel.secciones_apagadas);
    const reponer = productos.filter((p) => p.activo && stock[p.producto_id] && (stock[p.producto_id].stock <= 0
      || (stock[p.producto_id].minimo != null && stock[p.producto_id].stock <= stock[p.producto_id].minimo!)));
    // Lo que lleva a una pantalla apagada (o que el rol no ve) no se muestra: no hay a dónde ir.
    // VD-12e: lo que ya figura en "Para hacer hoy" no se repite en "Ahora y lo que sigue".
    const yaEnHacer = new Set(hacerHoy.map((x) => x.clave));
    const repetido = (a: Ahora) =>
      (a.tipo === "transferencias" && yaEnHacer.has("transferencias")) ||
      (a.tipo === "vencen" && yaEnHacer.has("vencen_hoy"));
    const ahora = datos.ahora.filter((a) => (!a.href || rutaDisponible(`/panel${a.href}`, rol, panel.secciones_apagadas)) && !repetido(a));

    return (
      <>
        {fichaje?.usa && fichaje.puede && <BotonFichar nombre={fichaje.nombre} enTurno={fichaje.en_turno} entradaEn={fichaje.entrada_en} sinSalidaDesde={fichaje.sin_salida_desde} zona={zona} />}
        {rol === "recepcion" && (() => {
          const turno = datos.ahora.find((a) => a.tipo === "caja");
          return turno && rutaDisponible("/panel/caja", rol, panel.secciones_apagadas) ? (
            <p data-turno className="tarjeta flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1"><span aria-hidden><Icono nombre={turno.emoji} /></span> {turno.titulo}{turno.detalle ? ` · ${turno.detalle}` : ""}</span>
              <Link href="/panel/caja" className="boton">{turno.tono ? "Abrir mi turno" : "Cerrar mi turno"}</Link>
            </p>
          ) : null;
        })()}
        <FueraDeServicio items={maquinasFuera} zona={zona} />
        <LockersVencen items={lockersVencen} />
        <NovedadesGymOS novedades={novedadesGymOS} />
        {pasos && <PrimerosPasos datos={pasos} />}
        {/* VD-43: socios de ejemplo (y su aviso fijo) · VD-42: dos pasos y alertas de seguridad. Solo el dueño. */}
        {rol === "dueno" && (
          <Suspense fallback={null}>
            <DatosEjemploInicio gimnasioId={panel.gimnasio.id} sinSociosReales={!!pasos && !pasos.pasos.find((p) => p.clave === "socios")?.hecho} />
            <SeguridadDueno gimnasioId={panel.gimnasio.id} zona={zona} />
          </Suspense>
        )}

        <section aria-label="Números de hoy">
          <NumerosInicio numeros={numerosElegidos?.numeros ?? datos.numeros} apagadas={panel.secciones_apagadas} />
          {rol === "dueno" && numerosElegidos && <ElegirNumeros disponibles={numerosElegidos.disponibles} elegidos={numerosElegidos.elegidos} />}
          {/* AVI-6: el detalle del día (quién cobró, caja, altas y bajas) y la semana. */}
          {(rol === "dueno" || rol === "encargado") && (
            <p className="mt-6"><Link href="/panel/resumen" className="texto-suave underline"><Icono nombre="grafico" /> Resumen de hoy: quién cobró, la caja, altas y bajas</Link></p>
          )}
        </section>

        {rol !== "profe" && (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-8 [&>*]:min-w-0">
            <section aria-labelledby="para-hacer" data-para-hacer={hacerHoy.length}>
              <h2 id="para-hacer" className="titulo text-3xl mb-4"><Icono nombre="ok" /> Para hacer hoy{hacerHoy.length > 0 ? ` (${hacerHoy.length})` : ""}</h2>
              {hacerHoy.length === 0 ? (
                <p className="texto-suave text-lg">Nada para hacer por ahora: todo al día. <Icono nombre="estrella" /></p>
              ) : (
                <ul className="space-y-2">
                  {hacerHoy.map((x) => (
                    <li key={x.clave} data-hacer={x.clave} className="tarjeta flex items-center gap-3 px-4 py-3 min-h-[68px]">
                      <span className="icono" aria-hidden><Icono nombre={x.emoji} /></span>
                      <span className="min-w-0 flex-1 font-semibold text-lg leading-tight">{x.texto}</span>
                      <Link href={`/panel${x.href}`} className="boton !min-h-11" aria-label={`Ver: ${x.texto}`}>Ver</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {verEntradas && (
              <section aria-labelledby="ultimas-entradas">
                <h2 id="ultimas-entradas" className="titulo text-3xl mb-4"><Icono nombre="puerta" /> Últimas entradas <span className="texto-tenue text-base font-normal">en vivo</span></h2>
                <UltimasEntradas iniciales={entradasVivo} zona={zona} />
              </section>
            )}
          </div>
        )}

        <section aria-labelledby="ahora">
          <h2 id="ahora" className="titulo text-3xl mb-4">Ahora y lo que sigue</h2>
          {ahora.length === 0 ? (
            <p className="texto-suave text-lg">Nada pendiente por ahora. <Icono nombre="estrella" /></p>
          ) : (
            <ul className="space-y-2">
              {ahora.map((a, i) => {
                const contenido = (
                  <>
                    <span className="icono" aria-hidden><Icono nombre={a.emoji} /></span>
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

        {(() => {
          const mias = tareas.tareas.filter((t) => t.mia && !t.hecha_en && t.dia <= tareas.hoy);
          return mias.length > 0 && (
            <section aria-labelledby="tareas-hoy" data-tareas-inicio={mias.length}>
              <h2 id="tareas-hoy" className="titulo text-3xl mb-1"><Icono nombre="chincheta" /> Tus tareas de hoy</h2>
              <p className="texto-suave mb-4">Las de hoy y las que quedaron atrasadas. <LinkPanel href="/panel/tareas" siNoEsta="texto" className="underline">Ver todas</LinkPanel></p>
              <ul className="space-y-2">{mias.map((t) => <FilaTarea key={t.id} t={t} hoy={tareas.hoy} />)}</ul>
            </section>
          );
        })()}

        {dejados.length > 0 && (
          <section aria-labelledby="dejados" data-dejados-pasar={dejados.length}>
            <h2 id="dejados" className="titulo text-3xl mb-1"><Icono nombre="puerta" /> Dejados pasar hoy</h2>
            <p className="texto-suave mb-4">Entraron sin poder: quién los dejó y por qué. <LinkPanel href="/panel/entrada/control" siNoEsta="texto" className="underline">Ver la semana</LinkPanel></p>
            <ul className="space-y-2">
              {dejados.map((x) => (
                <li key={x.ingreso_id}>
                  <LinkPanel href={`/panel/socios/${x.socio_id}`} siNoEsta="texto" className="tarjeta fila flex items-center gap-3 px-4 py-3 min-h-[68px]">
                    <span className="numero text-lg texto-suave w-12 flex-none">{new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(x.momento))}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-lg truncate">{x.socio}</span>
                      <span className="block texto-suave truncate">{x.por ?? "El equipo"}{x.autorizo && x.autorizo !== x.por ? ` (autorizó ${x.autorizo})` : ""}: “{x.motivo}” · {x.porque_no}{x.promete_el ? ` · promete pagar el ${x.promete_el.split("-").reverse().slice(0, 2).join("/")}` : ""}</span>
                    </span>
                  </LinkPanel>
                </li>
              ))}
            </ul>
          </section>
        )}

        {invitados.length > 0 && (
          <section aria-labelledby="invitados-hoy" data-invitados-hoy={invitados.length}>
            <h2 id="invitados-hoy" className="titulo text-3xl mb-4"><Icono nombre="usuarios" /> Invitados hoy</h2>
            <ul className="space-y-1">
              {invitados.map((i) => <li key={i.id} className="texto-suave">{i.entro_en ? "✓" : ""} <span className="text-[var(--texto)] font-semibold">{i.nombre}</span>, invitado por {i.socio}</li>)}
            </ul>
          </section>
        )}

        {olvidadas.length > 0 && (
          <section aria-labelledby="cajas-olvidadas" data-cajas-olvidadas={olvidadas.length}>
            <h2 id="cajas-olvidadas" className="titulo text-3xl mb-4"><Icono nombre="reloj" /> Caja abierta</h2>
            <ul className="space-y-2">
              {olvidadas.map((o) => (
                <li key={o.turno_id}>
                  <LinkPanel href="/panel/caja" siNoEsta="texto" className="tarjeta fila flex items-center gap-3 px-4 py-3 min-h-[68px]">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-lg">{o.caja} quedó abierta</span>
                      <span className="block texto-suave">Desde el {new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(o.abierto_en))}{o.mia ? " · la abriste vos" : ` · la abrió ${o.abierto_por}`}</span>
                    </span>
                    <span className="texto-suave">Cerrarla</span>
                  </LinkPanel>
                </li>
              ))}
            </ul>
          </section>
        )}

        {alertasCaja.length > 0 && <AlertasCaja alertas={alertasCaja} zona={zona} />}

        {reponer.length > 0 && rutaDisponible("/panel/planes", rol, panel.secciones_apagadas) && (
          <section aria-labelledby="reponer" data-reponer={reponer.length}>
            <h2 id="reponer" className="titulo text-3xl mb-4"><Icono nombre="caja" /> Por reponer</h2>
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
            <h2 id="pedidos-anulacion" className="titulo text-3xl mb-4"><Icono nombre="deshacer" /> Ventas para anular</h2>
            <ul className="space-y-2">{anular.map((v) => <FilaVenta key={v.venta_id} v={v} zona={zona} conSocio />)}</ul>
          </section>
        )}

        {pedidosBaja.length > 0 && (
          <section aria-labelledby="pedidos-baja" data-pedidos-baja-inicio={pedidosBaja.length}>
            <h2 id="pedidos-baja" className="titulo text-3xl mb-1"><Icono nombre="salir" /> Pidieron la baja</h2>
            <p className="texto-suave mb-4">Desde la app. Hablales antes: a veces una pausa o un cambio de plan alcanza.</p>
            <ul className="space-y-2">
              {pedidosBaja.map((x) => (
                <li key={x.pedido_id}>
                  <LinkPanel href={`/panel/socios/${x.socio_id}`} siNoEsta="texto" className="tarjeta fila flex items-center gap-3 px-4 py-3 min-h-[68px]">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-lg truncate">{x.nombre}</span>
                      <span className="block texto-suave truncate">Por {MOTIVO_BAJA[x.motivo] ?? x.motivo}{x.nota ? `: “${x.nota}”` : ""}{x.codigo ? ` · ${x.codigo}` : ""}</span>
                      {x.tarde && <span className="block font-semibold text-sm" data-baja-tarde><Icono nombre="reloj-arena" /> Hace más de 24 h que espera respuesta</span>}
                    </span>
                    <span className="texto-suave">Resolver</span>
                  </LinkPanel>
                </li>
              ))}
            </ul>
          </section>
        )}

        {pedidosPausa.length > 0 && (
          <section aria-labelledby="pedidos-pausa" data-pedidos-pausa={pedidosPausa.length}>
            <h2 id="pedidos-pausa" className="titulo text-3xl mb-4"><Icono nombre="pausa" /> Pausas para aprobar</h2>
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
            <h2 id="cumples" className="titulo text-3xl mb-4"><Icono nombre="calendario" /> Cumplen hoy</h2>
            <ul className="space-y-2">
              {cumples.map((c) => {
                const wa = linkWhatsappSocio(c.telefono, c.mensaje);
                return (
                  <li key={c.socio_id} className="tarjeta flex flex-wrap items-center gap-3 px-4 py-3 min-h-[68px]">
                    <span className="text-2xl" aria-hidden><Icono nombre="estrella" /></span>
                    <span className="min-w-0 flex-1">
                      <LinkPanel href={`/panel/socios/${c.socio_id}`} siNoEsta="texto" className="block font-semibold text-lg truncate">{c.nombre}</LinkPanel>
                      <span className="block texto-suave">Cumple {c.cumple}</span>
                    </span>
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="boton"><Icono nombre="mensaje" /> Saludar</a>}
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
