import type { Metadata } from "next";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { BotonCobrar } from "@/components/panel/cobrar/BotonCobrar";
import Link from "next/link";
import { VolverAlOrigen } from "@/components/panel/VolverAlOrigen";
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
import { BarraVigencia } from "@/components/panel/BarraVigencia";
import { Familia, type Familiar, type PlanFamiliar } from "./Familia";
import { Pausas, type DatosPausas } from "./Pausas";
import { AptoFisico, type DatosApto } from "./AptoFisico";
import { Origen, type DatosOrigen } from "./Origen";
import { Llavero, type DatosLlavero } from "./Llavero";
import { Convenio, type ConvenioSocio } from "./Convenio";
import type { Ficha } from "./tipos";
import { Firmar, type Pendiente } from "@/app/panel/documentos/Documentos";
import { GradosFicha } from "./GradosFicha";
import { FaltasSocio, type DetalleFaltas } from "./FaltasSocio";
import { BotonEntradaFicha } from "./BotonEntradaFicha";
import { ConstanciaBaja, ModeracionFicha } from "./ModeracionFicha";
import { Suspense } from "react";
import { VolverAEntrada } from "@/components/panel/VentanaEntrada";
import type { GradosSocio } from "@/lib/clases/grados";
import { estadoDe, motivoDe, type FilaHistorial } from "@/lib/mensajes";

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

export default async function FichaSocio({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ pestana?: string; mes?: string; sin_plan?: string; desde?: string }> }) {
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
    // VD-38: lo que este socio le escribió al gimnasio. Sin permiso (recepción sin el interruptor) la tarjeta no se muestra; la base exige el permiso igual.
    const pMensajes: Promise<FilaHistorial[] | null> = pestana === "resumen" && panel.yo.rol !== "profe" && !panel.secciones_apagadas.includes("mensajes")
      ? rpc<FilaHistorial[]>("historial_mensajes_socio", { p_socio_id: id }, { lectura: true }).catch(() => null) : Promise.resolve(null);
    // VD-46G: si el plan familiar está prendido, quién es el titular de su grupo (la tarjeta Familia lo muestra).
    const pPlanFamiliar: Promise<PlanFamiliar | null> = panel.yo.rol !== "profe" ? rpc<PlanFamiliar>("plan_familiar_socio", { p_socio_id: id }).catch(() => null) : Promise.resolve(null);
    const [f, planes, asistencia, ne, foto, fotoEstado, familia, pausas, apto, origen, llavero, ventas, convenio, convenios, faltas, turnos, horariosTurno, pedidoBaja, riesgo, primerMes, documentos, grados] = await Promise.all([
      rpc<Ficha>("ficha_socio", { p_socio_id: id }),
      rpc<Plan[]>("planes_gimnasio", { p_gimnasio_id: panel.gimnasio.id }),
      pestana === "asistencia" ? rpc<Asistencia>("asistencia_socio", { p_socio_id: id, p_mes: mes }) : Promise.resolve(null),
      rpc<NotasYEtiquetas>("notas_y_etiquetas", { p_socio_id: id }),
      rpc<string | null>("foto_socio", { p_socio_id: id }),
      rpc<{ subida_por_el_socio: boolean }>("foto_estado_socio", { p_socio_id: id }).catch(() => null),   // FA-16
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
      pestana === "asistencia" && panel.modo_clases === "reserva" ? rpc<DetalleFaltas>("faltas_socio_detalle", { p_socio_id: id }) : Promise.resolve(null),   // VD-46Q: con el perdón
      // CLA-2: turnos fijos (si el gimnasio los usa), desde el mostrador.
      pestana === "resumen" && mostrador ? rpc<{ prendido: boolean; turnos: Turno[] }>("turnos_socio", { p_socio_id: id }) : Promise.resolve(null),
      pestana === "resumen" && mostrador ? rpc<HorarioLibre[]>("horarios_para_turno", { p_socio_id: id }) : Promise.resolve([]),
      // APP-8: si pidió la baja desde la app.
      rpc<{ pedido_id: string; motivo: string; nota: string | null; codigo?: string; pedido_en?: string } | null>("pedido_baja_socio", { p_socio_id: id }),
      // COM-1: si está en riesgo de irse, el porqué (los mismos que ven Retención).
      pestana === "resumen" && panel.yo.rol !== "profe" ? rpc<{ nivel: "alto" | "medio"; porque: string[] }[]>("riesgo_baja", { p_gimnasio_id: panel.gimnasio.id, p_socio_id: id }) : Promise.resolve([]),
      // COM-2: los primeros 30 días del socio nuevo.
      pestana === "resumen" && panel.yo.rol !== "profe" ? rpc<{ dia: number; de: number; entradas: number; meta: number; primera_semana_floja: boolean } | null>("primer_mes_socio", { p_socio_id: id }) : Promise.resolve(null),
      // COM-6: lo que firmó y lo que le falta firmar (se firma acá, en el mostrador).
      pestana === "resumen" && panel.yo.rol !== "profe" ? rpc<{ pendientes: Pendiente[]; firmados: { titulo: string; version: number; nombre: string; via: string; firmado_en: string; vigente: boolean }[] }>("documentos_socio", { p_socio_id: id }) : Promise.resolve(null),
      // COM-13: su grado en las actividades con grados (cinturones).
      pestana === "resumen" && !panel.secciones_apagadas.includes("clases") ? rpc<GradosSocio>("grados_socio", { p_socio_id: id }) : Promise.resolve([] as GradosSocio),
    ]);
    const mensajesFicha = await pMensajes;
    const planFamiliar = await pPlanFamiliar;
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
          {sp.desde === "entrada"
            ? <VolverAEntrada socioId={s.id} nombre={`${s.nombre} ${s.apellido}`.trim()} />
            : <VolverAlOrigen href="/panel/socios" texto="Socios" className="texto-suave hover:text-[var(--texto)]" />}
          <div className="flex items-start gap-4 mt-4">
            <Foto socioId={s.id} iniciales={(s.nombre[0] ?? "") + (s.apellido[0] ?? "")} color={colorVar(v.color)}
              version={foto ? foto.slice(-36, -4) : null} subidaPorSocio={!!fotoEstado?.subida_por_el_socio} puedeConfirmar={panel.yo.rol !== "profe"} />
            <div className="min-w-0">
              <h1 className="titular text-5xl sm:text-6xl">{s.nombre} {s.apellido}</h1>
              <p className="texto-suave text-lg mt-1">Socio #{s.numero}{s.es_menor ? " · 👧 menor de edad" : ""}{s.tiene_app ? (s.es_menor ? " · 📱 el responsable usa la app" : " · 📱 usa la app") : ""}</p>
            </div>
          </div>
          <div className="mt-6">
            {s.dado_de_baja_en ? <span className="pildora">👋 Dado de baja el {fechaCorta(s.dado_de_baja_en, zona)}</span>
              : <PildoraEstado color={v.color}>{v.texto}</PildoraEstado>}
            {!s.dado_de_baja_en && v.vence_en && <div className="mt-3"><BarraVigencia venceEn={v.vence_en} color={v.color} /></div>}
          </div>
          {!s.dado_de_baja_en && <div className="mt-4"><AptoFisico socioId={s.id} datos={apto} /></div>}
          {!s.dado_de_baja_en && documentos && (documentos.pendientes.length > 0 || documentos.firmados.length > 0) && (
            <section className="mt-6 space-y-3" data-documentos-ficha={documentos.pendientes.length}>
              <p className="titulo-grupo">✍️ Documentos</p>
              {documentos.pendientes.map((d) => (
                <Firmar key={d.documento_id} socioId={s.id} doc={d} textoBoton="✍️ Firmó en recepción"
                  nombreSugerido={d.clave === "menores" ? (s.responsable_nombre ?? "") : `${s.nombre} ${s.apellido}`.trim()} />
              ))}
              {documentos.firmados.map((f) => (
                <p key={`${f.titulo}${f.version}`} className={`text-sm ${f.vigente ? "texto-suave" : "texto-tenue"}`}>✅ {f.titulo} (v{f.version}) · firmó {f.nombre} el {fechaCorta(f.firmado_en, zona)} {f.via === "app" ? "en la app" : "en recepción"}{f.vigente ? "" : " · versión anterior"}</p>
              ))}
            </section>
          )}
          {!s.dado_de_baja_en && grados.length > 0 && <GradosFicha socioId={s.id} grados={grados} zona={zona}
            puedeOtorgar={panel.yo.rol !== "recepcion"} puedeAnular={["dueno", "encargado"].includes(panel.yo.rol)} />}
          {!s.dado_de_baja_en && llavero.usa && <div className="mt-3"><Llavero socioId={s.id} datos={llavero} /></div>}
          {!s.dado_de_baja_en && pestana === "resumen" && (
            <div className="mt-3"><Convenio socioId={s.id} actual={convenio} opciones={convenios} zona={zona}
              puede={panel.yo.rol === "dueno" || panel.yo.rol === "encargado"} hoy={new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date())} /></div>
          )}
          <div className="mt-4"><Etiquetas socioId={s.id} etiquetas={ne.etiquetas} todas={ne.todas} /></div>
          {s.dado_de_baja_en && (
            <div className="mt-6 space-y-2" data-dado-de-baja>
              <p className="texto-suave">¿Volvió? Dalo de alta de nuevo y después asignale un plan y cobrale. La baja queda en su historial.</p>
              <Suspense fallback={null}><ConstanciaBaja socioId={s.id} zona={zona} verDevoluciones={["dueno", "encargado"].includes(panel.yo.rol)} /></Suspense>
              <VolverADarDeAlta socioId={s.id} />
              {panel.yo.rol === "dueno" && !(s.nombre === "Socio" && /^borrado #/.test(s.apellido)) && <BorrarDatos socioId={s.id} />}
            </div>
          )}
          {!s.dado_de_baja_en && pedidoBaja && <PedidoBaja socioId={s.id} pedido={pedidoBaja} />}
          {!s.dado_de_baja_en && <Suspense fallback={null}><ModeracionFicha socioId={s.id} zona={zona} /></Suspense>}
          {!s.dado_de_baja_en && panel.yo.rol !== "profe" && (
            <p className="mt-4"><LinkPanel href={`/panel/tareas?socio=${s.id}`} className="boton boton-chico">📌 Anotar una tarea sobre este socio</LinkPanel></p>
          )}
          {primerMes && !s.dado_de_baja_en && (
            <p className="pildora mt-6 !text-base" data-primer-mes={primerMes.dia}>
              🌱 Día {primerMes.dia} de {primerMes.de} · {primerMes.entradas} {primerMes.entradas === 1 ? "entrada" : "entradas"} (meta {primerMes.meta}){primerMes.entradas >= primerMes.meta ? " ✅" : ""}
            </p>
          )}
          {riesgo[0] && (
            <p className={`mensaje ${riesgo[0].nivel === "alto" ? "mensaje-error" : "mensaje-aviso"} mt-6`} data-riesgo-ficha={riesgo[0].nivel}>
              🎯 <span><strong>Riesgo {riesgo[0].nivel} de irse:</strong> {riesgo[0].porque.join(" · ")}.</span>
            </p>
          )}
          {!s.dado_de_baja_en && (
            <div className="flex flex-wrap gap-2 mt-6" data-ficha-acciones>
              {/* VD-15: Entrada y Cobrar siempre a mano en el encabezado (Entrada abre la ventana de VD-1 con este socio). */}
              {panel.yo.rol !== "profe" && <BotonEntradaFicha className="boton" socio={{ socio_id: s.id, numero: s.numero, nombre: `${s.nombre} ${s.apellido}`.trim(), color: v.color, texto: v.texto, puede: v.puede, dado_de_baja: false }} />}
              {!v.puede || v.color === "amarillo"
                ? <BotonCobrar socioId={s.id} origen="ficha" className="boton boton-principal">💵 Cobrar{v.para_regularizar ? ` ${formatearPesos(v.para_regularizar)}` : ""}</BotonCobrar>
                : <>
                    <BotonCobrar socioId={s.id} origen="ficha" className="boton">💵 Cobrar</BotonCobrar>
                    <LinkPanel href={`/panel/vender?socio=${s.id}`} className="boton">🛒 Vender</LinkPanel>
                  </>}
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
          <Familia socioId={s.id} familia={familia} plan={planFamiliar} puedeArmar={panel.yo.rol === "dueno" || panel.yo.rol === "encargado"} />
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
        {mensajesFicha && (
          <section data-historial-mensajes>
            <h2 className="titulo text-3xl mb-4">💬 Mensajes</h2>
            {mensajesFicha.length === 0 ? <p className="texto-suave">Todavía no le escribió al gimnasio desde la app.</p> : (
              <ul className="space-y-2">
                {mensajesFicha.map((m) => (
                  <li key={m.hilo_id}>
                    <Link href={`/panel/mensajes?estado=todos&hilo=${m.hilo_id}`} className="tarjeta flex items-start gap-3 p-4">
                      <span aria-hidden>{motivoDe(m.motivo).emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{motivoDe(m.motivo).titulo} · {estadoDe(m.estado).titulo}{m.sin_responder && <span className="pildora pildora-rojo ml-2 !text-xs">Sin responder</span>}</span>
                        {m.extracto && <span className="block texto-suave truncate">{m.extracto}</span>}
                        <span className="block text-sm texto-tenue">{momento(m.ultimo_en)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
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
        {pestana === "asistencia" && faltas && <FaltasSocio socioId={s.id} d={faltas} zona={zona} />}

        {pestana === "notas" && <Notas socioId={s.id} notas={ne.notas} zona={zona} notaVieja={s.notas} />}
      </div>
    );
  });
}
