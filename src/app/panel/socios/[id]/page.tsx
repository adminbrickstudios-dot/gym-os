import type { Metadata } from "next";
import { LinkPanel } from "@/components/panel/LinkPanel";
import Link from "next/link";
import { colorVar, PildoraEstado, PuntoEstado } from "@/components/panel/Estado";
import { fechaCorta, formatearPesos } from "@/lib/formato";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, exigirSeccion, rpc } from "@/lib/panel/servidor";
import { BorrarDatos, CambiarPlan, DarDeBaja, PedidoBaja, VolverADarDeAlta } from "./Acciones";
import { FilaVenta } from "@/components/panel/Venta";
import type { Venta } from "@/app/panel/ventas-acciones";
import { Pestanas } from "@/components/ui/Pestanas";
import { Calendario, type Asistencia } from "./Calendario";
import { TurnosFijos, type HorarioLibre, type Turno } from "@/components/TurnosFijos";
import { Etiquetas, Notas, type NotasYEtiquetas } from "./NotasEtiquetas";
import { Foto } from "./Foto";
import { Familia, type Familiar } from "./Familia";
import { Pausas, type DatosPausas } from "./Pausas";
import { AptoFisico, type DatosApto } from "./AptoFisico";
import { Origen, type DatosOrigen } from "./Origen";
import { Llavero, type DatosLlavero } from "./Llavero";
import { Convenio, type ConvenioSocio } from "./Convenio";
import type { Ficha } from "./tipos";

export const metadata: Metadata = { title: "Ficha del socio" };

const RESULTADO: Record<string, string> = { entro: "Entró", entro_modo_aviso: "Entró con aviso", forzado: "Lo dejaron pasar", rechazado: "No pudo entrar" };
type Plan = { plan_id: string; tipo: string; nombre: string; activo: boolean; precio: number | null };

function Dato({ etiqueta, valor }: { etiqueta: string; valor?: React.ReactNode }) {
  if (!valor) return null;
  return <div><dt className="text-sm texto-tenue">{etiqueta}</dt><dd className="text-lg">{valor}</dd></div>;
}

const PESTANAS = [
  { clave: "resumen", texto: "Resumen", emoji: "👤" }, { clave: "pagos", texto: "Pagos", emoji: "💵" },
  { clave: "asistencia", texto: "Asistencia", emoji: "📅" }, { clave: "notas", texto: "Notas", emoji: "📝" },
] as const;
type Pestana = (typeof PESTANAS)[number]["clave"];

export default async function FichaSocio({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pestana?: string; mes?: string; sin_plan?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const pestana: Pestana = PESTANAS.find((p) => p.clave === sp.pestana)?.clave ?? "resumen";
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? `${sp.mes}-01` : null;
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno", "encargado", "recepcion"]);
    exigirSeccion(panel, "socios");
    const veVentas = pestana === "pagos" && (panel.yo.rol === "dueno" || panel.yo.rol === "encargado");
    const mostrador = panel.yo.rol !== "profe" && panel.modo_clases === "reserva";
    const [f, planes, asistencia, ne, foto, familia, pausas, apto, origen, llavero, ventas, convenio, convenios, faltas, turnos, horariosTurno, pedidoBaja, riesgo] = await Promise.all([
      rpc<Ficha>("ficha_socio", { p_socio_id: id }),
      rpc<Plan[]>("planes_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      pestana === "asistencia" ? rpc<Asistencia>("asistencia_socio", { p_socio_id: id, p_mes: mes }) : Promise.resolve(null),
      rpc<NotasYEtiquetas>("notas_y_etiquetas", { p_socio_id: id }),
      rpc<string | null>("foto_socio", { p_socio_id: id }),
      rpc<Familiar[]>("familia_socio", { p_socio_id: id }),
      rpc<DatosPausas>("pausas_socio", { p_socio_id: id }),
      rpc<DatosApto>("apto_socio", { p_socio_id: id }),
      rpc<DatosOrigen>("origen_socio", { p_socio_id: id }),
      rpc<DatosLlavero>("llavero_socio", { p_socio_id: id }),
      // VEN-6: las ventas con su estado y "Anular" (dueño y encargado).
      veVentas ? rpc<Venta[]>("ventas_socio", { p_socio_id: id }) : Promise.resolve(null),
      // VEN-3: el convenio del socio y los del gimnasio para elegir.
      pestana === "resumen" ? rpc<ConvenioSocio>("convenio_socio", { p_socio_id: id }) : Promise.resolve(null),
      pestana === "resumen" ? rpc<{ convenio_id: string; nombre: string; tipo: string; valor: number; activo: boolean }[]>("convenios_gimnasio", { p_gimnasio_id: panel.gimnasio.id }) : Promise.resolve([]),
      // CLA-1: las clases que reservó y no vino (sin cancelar), últimos 60 días.
      pestana === "asistencia" && panel.modo_clases === "reserva" ? rpc<{ clase_id: string; actividad: string; inicio: string }[]>("faltas_socio", { p_socio_id: id }) : Promise.resolve([]),
      // CLA-2: turnos fijos (si el gimnasio los usa), desde el mostrador.
      pestana === "resumen" && mostrador ? rpc<{ prendido: boolean; turnos: Turno[] }>("turnos_socio", { p_socio_id: id }) : Promise.resolve(null),
      pestana === "resumen" && mostrador ? rpc<HorarioLibre[]>("horarios_para_turno", { p_socio_id: id }) : Promise.resolve([]),
      // APP-8: si pidió la baja desde la app.
      rpc<{ pedido_id: string; motivo: string; nota: string | null } | null>("pedido_baja_socio", { p_socio_id: id }),
      // COM-1: si está en riesgo de irse, el porqué (los mismos que ven Retención).
      pestana === "resumen" && panel.yo.rol !== "profe" ? rpc<{ nivel: "alto" | "medio"; porque: string[] }[]>("riesgo_baja", { p_gimnasio_id: panel.gimnasio.id, p_socio_id: id }) : Promise.resolve([]),
    ]);
    const zona = panel.gimnasio.zona_horaria;
    const { socio: s, acceso: v } = f;
    const momento = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    // Un menor (D10): se le escribe al responsable.
    const celular = s.es_menor ? s.responsable_telefono : s.telefono;
    const wa = celular ? `https://wa.me/${celular.replace(/\D/g, "")}` : null;
    const membresias = planes.filter((p) => p.tipo === "membresia" && p.activo);

    return (
      <div className="space-y-10">
        {sp.sin_plan && !f.membresia && <p role="alert" className="pildora pildora-amarillo whitespace-normal">⚠️ Quedó dado de alta, pero el plan no se pudo asignar: asignalo con “🏷️ Asignar plan”.</p>}
        <header>
          <Link href="/panel/socios" className="texto-suave hover:text-[var(--texto)]">← Socios</Link>
          <div className="flex items-start gap-4 mt-4">
            <Foto socioId={s.id} iniciales={(s.nombre[0] ?? "") + (s.apellido[0] ?? "")} color={colorVar(v.color)}
              version={foto ? foto.slice(-36, -4) : null} />
            <div className="min-w-0">
              <h1 className="titular text-5xl sm:text-6xl">{s.nombre} {s.apellido}</h1>
              <p className="texto-suave text-lg mt-1">Socio #{s.numero}{s.es_menor ? " · 👧 menor de edad" : ""}{s.tiene_app ? (s.es_menor ? " · 📱 el responsable usa la app" : " · 📱 usa la app") : ""}</p>
            </div>
          </div>
          <div className="mt-6">
            {s.dado_de_baja_en ? <span className="pildora">👋 Dado de baja el {fechaCorta(s.dado_de_baja_en, zona)}</span>
              : <PildoraEstado color={v.color}>{v.texto}</PildoraEstado>}
          </div>
          {!s.dado_de_baja_en && <div className="mt-4"><AptoFisico socioId={s.id} datos={apto} /></div>}
          {!s.dado_de_baja_en && llavero.usa && <div className="mt-3"><Llavero socioId={s.id} datos={llavero} /></div>}
          {!s.dado_de_baja_en && pestana === "resumen" && (
            <div className="mt-3"><Convenio socioId={s.id} actual={convenio} opciones={convenios} zona={zona}
              puede={panel.yo.rol === "dueno" || panel.yo.rol === "encargado"} hoy={new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date())} /></div>
          )}
          <div className="mt-4"><Etiquetas socioId={s.id} etiquetas={ne.etiquetas} todas={ne.todas} /></div>
          {s.dado_de_baja_en && (
            <div className="mt-6 space-y-2" data-dado-de-baja>
              <p className="texto-suave">¿Volvió? Dalo de alta de nuevo y después asignale un plan y cobrale. La baja queda en su historial.</p>
              <VolverADarDeAlta socioId={s.id} />
              {panel.yo.rol === "dueno" && !(s.nombre === "Socio" && /^borrado #/.test(s.apellido)) && <BorrarDatos socioId={s.id} />}
            </div>
          )}
          {!s.dado_de_baja_en && pedidoBaja && <PedidoBaja socioId={s.id} pedido={pedidoBaja} />}
          {riesgo[0] && (
            <p className={`mensaje ${riesgo[0].nivel === "alto" ? "mensaje-error" : "mensaje-aviso"} mt-6`} data-riesgo-ficha={riesgo[0].nivel}>
              🎯 <span><strong>Riesgo {riesgo[0].nivel} de irse:</strong> {riesgo[0].porque.join(" · ")}.</span>
            </p>
          )}
          {!s.dado_de_baja_en && (
            <div className="flex flex-wrap gap-2 mt-6">
              {!v.puede || v.color === "amarillo"
                ? <LinkPanel href={`/panel/vender?socio=${s.id}`} className="boton boton-principal">💵 Cobrar{v.para_regularizar ? ` ${formatearPesos(v.para_regularizar)}` : ""}</LinkPanel>
                : <LinkPanel href={`/panel/vender?socio=${s.id}`} className="boton">🛒 Vender</LinkPanel>}
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="boton">💬 WhatsApp</a>}
              <Link href={`/panel/socios/${s.id}/editar`} className="boton">✏️ Editar</Link>
              <CambiarPlan socioId={s.id} actual={f.membresia?.plan_id ?? null} planes={membresias} />
              <DarDeBaja socioId={s.id} ofrecePausa={!!f.membresia && !!pausas.suscripcion_id} />
            </div>
          )}
        </header>

        <Pestanas etiqueta="Partes de la ficha" activa={pestana}
          pestanas={PESTANAS.filter((p) => p.clave !== "pagos" || f.pagos).map((p) => ({ ...p, href: `/panel/socios/${s.id}?pestana=${p.clave}` }))} />

        {pestana === "resumen" && <>
        <section className="grid sm:grid-cols-2 gap-3">
          <div className="tarjeta p-6">
            <p className="titulo text-2xl mb-4">🏷️ Plan</p>
            {f.membresia ? (
              <dl className="space-y-3">
                <Dato etiqueta="Plan" valor={f.membresia.plan} />
                <Dato etiqueta="Desde" valor={fechaCorta(f.membresia.inicio, zona)} />
                <Dato etiqueta="Precio de lista" valor={f.membresia.precio != null ? formatearPesos(f.membresia.precio) : "Sin precio cargado"} />
                {v.vence_en && <Dato etiqueta="Cubierto hasta" valor={fechaCorta(new Date(new Date(v.vence_en).getTime() - 1), zona)} />}
              </dl>
            ) : <p className="texto-suave">Sin membresía. Puede entrar con pase o pack.</p>}
            {f.packs.map((p) => (
              <p key={p.id} className="mt-4 pildora pildora-azul">🎟️ {p.plan}: le quedan {p.cantidad - p.usadas} de {p.cantidad}</p>
            ))}
          </div>
          <div className="tarjeta p-6">
            <p className="titulo text-2xl mb-4">📱 Contacto</p>
            <dl className="space-y-3">
              {s.responsable_nombre && <Dato etiqueta={s.es_menor ? "👨‍👧 Responsable (es menor)" : "Responsable"} valor={`${s.responsable_nombre} · ${s.responsable_telefono ?? ""}`} />}
              <Dato etiqueta={s.es_menor ? "WhatsApp del menor" : "WhatsApp"} valor={s.telefono} />
              <Dato etiqueta="Mail" valor={s.email} />
              <Dato etiqueta="DNI" valor={s.dni} />
              <Dato etiqueta="Emergencia" valor={s.contacto_emergencia_nombre ? `${s.contacto_emergencia_nombre} · ${s.contacto_emergencia_telefono ?? ""}` : null} />
            </dl>
            {!s.telefono && !s.email && !s.dni && !s.responsable_nombre && <p className="texto-suave">Sin datos de contacto.</p>}
            <div className="mt-5 pt-4 border-t border-[var(--borde)]"><Origen socioId={s.id} datos={origen} zona={zona} /></div>
          </div>
          {!s.dado_de_baja_en && <Pausas socioId={s.id} datos={pausas} />}
          <Familia socioId={s.id} familia={familia} />
        </section>

        <section>
          <h2 className="titulo text-3xl mb-4">🚪 Últimas entradas</h2>
          {f.ingresos.length === 0 ? <p className="texto-suave">Todavía no vino.</p> : (
            <ul className="space-y-1">
              {f.ingresos.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-2">
                  <PuntoEstado color={i.resultado === "rechazado" ? "rojo" : i.color} />
                  <span className="numero text-lg w-28 texto-suave">{momento(i.momento)}</span>
                  <span className="truncate">{RESULTADO[i.resultado] ?? i.resultado}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        {turnos?.prendido && !s.dado_de_baja_en && <TurnosFijos socioId={s.id} turnos={turnos.turnos} horarios={horariosTurno} quien="equipo" />}

        </>}

        {pestana === "pagos" && ventas && (
          <section>
            <h2 className="titulo text-3xl mb-4">💵 Pagos</h2>
            {ventas.length === 0 ? <p className="texto-suave">Todavía no se le cobró nada. Lo que se le venda aparece acá.</p> : (
              <ul className="space-y-2" data-ventas>{ventas.map((v) => <FilaVenta key={v.venta_id} v={v} zona={zona} />)}</ul>
            )}
          </section>
        )}
        {pestana === "pagos" && !ventas && <p className="texto-suave">Los pagos los ven el dueño y el encargado.</p>}

        {pestana === "asistencia" && asistencia && <Calendario a={asistencia} socioId={s.id} />}
        {pestana === "asistencia" && faltas.length > 0 && (
          <section className="mt-8" data-faltas-socio>
            <h2 className="titulo text-2xl mb-2">🙈 Reservó y no vino</h2>
            <ul className="space-y-1">{faltas.map((x) => (
              <li key={x.clase_id} className="texto-suave">{x.actividad} · <span className="first-letter:uppercase">{new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "short", day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(x.inicio))}</span></li>
            ))}</ul>
          </section>
        )}

        {pestana === "notas" && <Notas socioId={s.id} notas={ne.notas} zona={zona} notaVieja={s.notas} />}
      </div>
    );
  });
}
