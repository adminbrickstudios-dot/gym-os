import { headers } from "next/headers";
import { conSemaforo } from "@/lib/semaforo";
import { ResultadoPuerta, type ColorPuerta } from "@/components/ResultadoPuerta";
import Link from "next/link";
import { Recomendacion } from "./Recomendacion";
import { AvisosDelDia, type AvisoDelDia } from "./AvisosDelDia";
import { AvisoClave, type AvisoClaveDatos } from "./AvisoClave";
import type { OfertaLugarDatos } from "./OfertasLugar";
import type { AvisoApp } from "./AvisosSocio";
import type { ResumenApp } from "@/lib/app/resumen";
import { colorVar } from "@/components/panel/Estado";
import { Aviso } from "@/components/panel/Marco";
import { fechaCorta, formatearDni, formatearPesos } from "@/lib/formato";
import { miSocio } from "@/lib/app/socio";
import { traerAgenda } from "@/lib/landing";
import { raizDelGimnasio } from "@/lib/app/raiz-gimnasio";
import { textoCierre } from "@/lib/horarios";
import { intentar } from "@/lib/panel/intentar";
import { CancelarReserva } from "./CancelarReserva";
import { Pagar } from "./Pagar";
import { PagarOnline } from "./PagarOnline";
import { Instalar } from "./Instalar";
import { MiQR } from "./MiQR";
import { QrBloqueado } from "./QrBloqueado";
import { EscanearEntrada } from "./EscanearEntrada";
import { Invitar, type MisInvitados } from "./Invitar";
import { Referir, type LinkReferido } from "./Referir";
import { rpcLote, lectura } from "@/lib/panel/servidor";
import { Firmar, type Pendiente } from "@/app/panel/documentos/Documentos";
import { EventosApp, type EventoApp } from "./EventosApp";
import { Encuesta } from "./Encuesta";
import { Bienvenida } from "./Bienvenida";
import { ReglamentoNuevo } from "./ReglamentoNuevo";
import { OcupacionEnVivo } from "./OcupacionEnVivo";
import { AvisosInicio } from "./AvisosInicio";
import { Entraste } from "./Entraste";
import { ProgresoInicio, type ProgresoSocio } from "./ProgresoInicio";
import { textoRequisitos, type GradosSocio } from "@/lib/clases/grados";
import { Icono } from "@/components/ui/Icono";

const EMOJI: Record<string, string> = { verde: "ok", amarillo: "alerta", naranja: "alerta", rojo: "prohibido", gris: "ayuda" };

export default async function AppSocio({ searchParams }: { searchParams: Promise<{ socio?: string }> }) {
  const pedido = (await searchParams).socio;
  return intentar(async () => {
    const semaforo = await conSemaforo();
    const host = (await headers()).get("x-gimnasio-host");
    const [{ g, yo }, agenda] = await Promise.all([miSocio(pedido), host ? traerAgenda(host) : null]);
    if (yo.elegir) {
      return (
        <>
          <h1 className="titular text-5xl">¿Quién entrena hoy?</h1>
          <p className="texto-suave text-lg mt-2">Tu cuenta tiene varios socios.</p>
          <ul className="mt-8 space-y-2">{yo.socios.map((s) => (
            <li key={s.socio_id}><Link href={`/app?socio=${s.socio_id}`} className="boton w-full !justify-start text-lg"><Icono nombre="persona" /> {s.nombre}</Link></li>
          ))}</ul>
        </>
      );
    }
    const v = yo.acceso!; const s = yo.socio!;
    const zona = yo.zona!;
    const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
    const debePagar = !v.puede || v.color === "amarillo" || v.color === "naranja";
    // L3: "pagá tu plan" arriba y el QR bloqueado, solo cuando lo que falta es pagar (no cuando está congelado o suspendido).
    // D83: quien creó su cuenta y todavía no tiene plan ("sin plan activo") también tiene que pagar para empezar a entrar.
    const faltaPagar = !v.puede && (v.para_regularizar != null || v.motivo === "sin_plan" || /sin pagar|venci|deb[eé]|deuda|pag[aá]/i.test(v.texto ?? ""));
    // El QR solo si el gimnasio lo usa (si no, la base dice que no y no se muestra).
    // Cacería (16/11): las 14 lecturas del Inicio en UN viaje (lote_lecturas, cada una con los permisos del propio socio). Las que antes tenían
    // `.catch` van como tolerantes (si fallan, valen null y no se muestran); las demás, si fallan, rompen la pantalla como antes.
    const pg = { p_gimnasio_id: g.id }, ps = { p_socio_id: s.socio_id };
    const [qr0, qrPared0, invitados, campana, online, progreso, novedades0, referido, rutina, documentos, eventos, encuesta, grados, dni, salida0, avisoClave, misAvisos, ocupacion, ofertas, avisosDelDia, resumen] = await rpcLote(
      lectura<{ codigo: string; vence_en: string } | null>("mi_qr", { ...pg, ...ps }, true),   // el QR solo si el gimnasio lo usa (si no, la base dice que no y no se muestra)
      lectura<boolean | null>("usa_qr_pared", pg, true),
      lectura<MisInvitados | null>("mis_invitados", { ...pg, ...ps }, true),
      lectura<{ sin_leer: number } | null>("campana_socio", { ...pg, ...ps }, true),   // AVI-5: cuántas novedades sin ver (si falla, no se muestra un cero que no es)
      lectura<{ disponible: boolean; monto?: number; descripcion?: string } | null>("pago_online_disponible", ps, true),   // PAY-1: si el gimnasio conectó MercadoPago
      lectura<ProgresoSocio | null>("progreso_inicio", ps, true),   // VD-23: la semana, la racha, la meta del mes, el hito y "entraste": todo lo calcula la base
      lectura<{ id: string; texto: string }[] | null>("novedades_socio", ps, true),   // APP-6: lo que publicó el gimnasio
      lectura<LinkReferido | null>("mi_link_referido", ps, true),   // REF-1: su link para invitar (null si la página no recibe pedidos)
      lectura<{ nombre: string } | null>("rutina_de_socio", ps, true),   // RUT-2: si el profe le asignó una rutina
      lectura<{ pendientes: Pendiente[]; reglamento_nuevo?: { version: number; texto: string } | null }>("documentos_socio", ps),   // COM-6: lo que le falta firmar
      lectura<EventoApp[]>("eventos_socio", ps),   // COM-8: los eventos que vienen (y si ya está anotado)
      lectura<{ pendiente: boolean }>("encuesta_socio", ps),   // COM-10: la pregunta del 0 al 10
      lectura<GradosSocio>("grados_socio", ps),   // COM-13: su grado (cinturón)
      lectura<string | null>("mi_dni", ps, true),   // SOCIO-FLUJO §4: "Tu DNI para entrar" cuando el gimnasio no usa el QR
      lectura<string | null>("registra_salida", pg, true),   // VD-48: "Me voy" si el gimnasio registra la salida (antes se pedía aparte y solo con el QR de la pared: el número de viajes dependía de eso)
      // Paneles completos (19/11): lo que antes se pedía aparte dentro de <Suspense> (5 viajes más) va en este mismo viaje. Todas tolerantes: si fallan valen null y no se muestran.
      lectura<AvisoClaveDatos | null>("aviso_clave_socio", ps, true),
      lectura<AvisoApp[] | null>("mis_avisos", ps, true),
      lectura<{ visible: boolean; personas?: number } | null>("ocupacion_en_vivo", pg, true),
      lectura<OfertaLugarDatos[] | null>("ofertas_socio", ps, true),
      lectura<AvisoDelDia[] | null>("avisos_app_socio", ps, true),
      lectura<ResumenApp | null>("resumen_app_socio", ps, true),
    );
    const qr = qr0 ?? null, qrPared = qrPared0 ?? false, novedades = novedades0 ?? [];
    // VD-48: "Me voy" solo si el gimnasio registra la salida (si la pregunta falla, no se muestra).
    const registraSalida = qrPared ? (salida0 ?? "no") !== "no" : false;
    const q =yo.socios.length > 1 ? `?socio=${s.socio_id}` : "";
    // VD-23: vencido o por vencer, pagar va arriba de todo (pegado al semáforo); al día, más abajo.
    const bloquePago = (
      <>
        {yo.pendiente && (
          <p className="pildora pildora-azul !rounded-[var(--radio)] !px-4 !py-3 w-full"><Icono nombre="recibo" /> Informaste {formatearPesos(yo.pendiente.monto)}: el gimnasio lo está revisando.</p>
        )}
        {!yo.pendiente && online?.disponible && <PagarOnline socioId={s.socio_id} monto={online.monto!} descripcion={online.descripcion!} adelantar={!debePagar} />}
        {!yo.pendiente && debePagar && yo.transferencia && (
          <Pagar gimnasioId={g.id} socioId={s.socio_id} monto={yo.plan?.precio_transferencia ?? null} datos={yo.transferencia} secundario={!!online?.disponible} />
        )}
      </>
    );
    // El WhatsApp del gimnasio vive en "Info del gimnasio" (un toque): leerlo acá sumaría un viaje a la pantalla que más se abre (tope de viajes).
    const hayClases = yo.modo_clases !== "ninguno";
    const raiz = await raizDelGimnasio();
    type BotonInicio = { clave: string; href: string; icono: string; titulo: string; principal?: boolean; externo?: boolean };
    const botonesInicio: BotonInicio[] = ((faltaPagar ? [
      { clave: "pagar", href: "#paga-tu-plan", icono: "tarjeta", titulo: "Pagá tu plan", principal: true },
      { clave: "qr", href: "#mi-qr", icono: "llave", titulo: "Mi QR" },
      hayClases ? { clave: "clases", href: `/app/clases${q}`, icono: "calendario", titulo: "Clases y horarios" } : { clave: "horarios", href: `/app/info${q}`, icono: "reloj", titulo: "Horarios" },
      { clave: "planes", href: `/app/plan${q}`, icono: "etiqueta", titulo: "Planes" },
      { clave: "perfil", href: `/app/yo${q}`, icono: "persona", titulo: "Mi perfil" },
      { clave: "whatsapp", href: `/app/info${q}#whatsapp`, icono: "mensaje", titulo: "WhatsApp" },
    ] : [
      { clave: "qr", href: "#mi-qr", icono: "llave", titulo: "Mi QR", principal: true },
      yo.modo_clases === "reserva" ? { clave: "reservar", href: `/app/clases${q}`, icono: "calendario", titulo: "Reservar" } : hayClases ? { clave: "clases", href: `/app/clases${q}`, icono: "calendario", titulo: "Clases y horarios" } : null,
      { clave: "pagos", href: `/app/historial${q}`, icono: "recibo", titulo: "Mis pagos" },
      { clave: "plan", href: `/app/plan${q}`, icono: "tarjeta", titulo: "Mi plan" },
      { clave: "perfil", href: `/app/yo${q}`, icono: "persona", titulo: "Mi perfil" },
      { clave: "whatsapp", href: `/app/info${q}#whatsapp`, icono: "mensaje", titulo: "WhatsApp" },
    ]) as (BotonInicio | null)[]).filter((b): b is BotonInicio => !!b).slice(0, 6);
    return (
      <div className="space-y-6">
        {progreso?.bienvenida_pendiente && <Bienvenida socioId={s.socio_id} nombre={s.nombre} qr={!!qr || qrPared} clases={(yo.modo_clases ?? "ninguno") as "reserva" | "sin_reserva" | "ninguno"} pagos={!!yo.transferencia || !!online?.disponible} />}
        <header className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="texto-suave text-lg" data-hola>Hola, {s.nombre}</p>
            {yo.socios.length > 1 && <Link href="/app" className="text-sm texto-tenue">Cambiar de socio</Link>}
          </div>
          {campana && (
            <Link href={`/app/novedades?socio=${s.socio_id}`} data-campana={campana.sin_leer}
              aria-label={campana.sin_leer ? `Novedades: ${campana.sin_leer} sin ver` : "Novedades"}
              className="relative grid place-items-center size-11 flex-none rounded-full border border-[var(--borde)] bg-[var(--tarjeta)] text-xl active:scale-95 transition">
              <span aria-hidden><Icono nombre="campana" /></span>
              {campana.sin_leer > 0 && (
                <span aria-hidden className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-xs font-bold grid place-items-center text-white" style={{ background: "var(--rojo)" }}>
                  {campana.sin_leer > 99 ? "99+" : campana.sin_leer}
                </span>
              )}
            </Link>
          )}
        </header>

        {documentos.reglamento_nuevo && <ReglamentoNuevo socioId={s.socio_id} version={documentos.reglamento_nuevo.version} texto={documentos.reglamento_nuevo.texto} />}
        {avisoClave && <AvisoClave socioId={s.socio_id} aviso={avisoClave} zona={zona} />}
        <AvisosInicio avisos={misAvisos} />
        <OcupacionEnVivo r={ocupacion} />
        {novedades.map((n) => <p key={n.id} className="mensaje mensaje-info" data-novedad-app><Icono nombre="campana" /> {n.texto}</p>)}

        {faltaPagar && (
          <section id="paga-tu-plan" className="tarjeta p-6 space-y-3 border-2 scroll-mt-4" style={{ borderColor: "var(--acento)" }} data-paga-tu-plan>
            <p className="titulo text-2xl"><Icono nombre="tarjeta" /> Para empezar a entrar, pagá tu plan</p>
            {yo.plan && <p className="text-xl" data-plan-a-pagar>{yo.plan.nombre}{yo.plan.precio_transferencia != null && <> · <strong className="numero">{formatearPesos(yo.plan.precio_transferencia)}</strong></>}</p>}
            <p className="text-lg" data-pagar-en-recepcion><Icono nombre="persona" /> <strong>Pagá en la recepción:</strong> decí tu DNI{dni ? <> (<span className="numero">{formatearDni(dni)}</span>)</> : ""} y te cobran.</p>
            {bloquePago}
          </section>
        )}

        {semaforo ? (
          // Pista Semáforo (app-socio.png / app-socio-debe.png): el estado lleno del color, con el QR (o el DNI) adentro. El texto sale de la base.
          <ResultadoPuerta color={(["verde", "amarillo", "rojo"].includes(v.color) ? v.color : "gris") as ColorPuerta} puede={v.puede}
            titulo={v.puede ? "Podés entrar" : "No podés entrar"} data-estado-app={v.color}
            detalle={<>{v.texto}{v.vence_en && v.puede && <span className="block" data-cubierto-hasta>Cubierto hasta el {fechaCorta(new Date(new Date(v.vence_en).getTime() - 1), zona)}{(() => { const n = Math.ceil((new Date(v.vence_en).getTime() - Date.now()) / 86400000); return n === 0 ? " · vence hoy" : n > 0 ? ` · te ${n === 1 ? "queda 1 día" : `quedan ${n} días`}` : ""; })()}</span>}</>}>
            <div id="mi-qr" className="space-y-4 scroll-mt-4" data-bloque-qr>
              {qrPared && <EscanearEntrada gimnasioId={g.id} socioId={s.socio_id} principal={!debePagar} conSalida={registraSalida} />}
              {qr && (v.puede
                ? <MiQR gimnasioId={g.id} socioId={s.socio_id} inicial={qr} />
                : <QrBloqueado socioId={s.socio_id} titulo={faltaPagar ? "Tu QR se activa cuando pagues" : "Tu QR está bloqueado"}
                    detalle={faltaPagar ? "Apenas pagues se prende solo: no hace falta recargar." : (v.texto ?? "Hoy no podés entrar.")} />)}
              {!qr && !qrPared && dni && <p className="numero text-5xl" data-tu-dni-inicio>{formatearDni(dni)}</p>}
            </div>
          </ResultadoPuerta>
          ) : null}
        {semaforo && debePagar && !faltaPagar && bloquePago}
        {semaforo ? null : (<>
        <section className="rounded-[var(--radio-grande)] p-6 border"
          style={{ background: `color-mix(in oklab, ${colorVar(v.color)}, var(--fondo) 82%)`, borderColor: `color-mix(in oklab, ${colorVar(v.color)}, var(--fondo) 55%)` }}>
          <p className="text-5xl" aria-hidden><Icono nombre={EMOJI[v.color] ?? "ayuda"} /></p>
          <p className="titular text-5xl mt-4">{v.puede ? "Podés entrar" : "No podés entrar"}</p>
          <p className="text-xl mt-2 font-semibold">{v.texto}</p>
          {v.vence_en && v.puede && <p className="texto-suave mt-1" data-cubierto-hasta>Cubierto hasta el {fechaCorta(new Date(new Date(v.vence_en).getTime() - 1), zona)}{(() => { const n = Math.ceil((new Date(v.vence_en).getTime() - Date.now()) / 86400000); return n === 0 ? " · vence hoy" : n > 0 ? ` · te ${n === 1 ? "queda 1 día" : `quedan ${n} días`}` : ""; })()}</p>}
          <p className="texto-tenue text-sm mt-4">Socio #{s.numero}</p>
        </section>

        {/* VD-23b y SOCIO-FLUJO §4 ("Tenés que pagar… con el botón Pagar"): quien debe ve Pagar pegado al estado, sin bajar la pantalla. */}
        {debePagar && !faltaPagar && bloquePago}

        {/* SOCIO-FLUJO §4: lo primero después del estado es cómo entra: el QR (que cambia) o, si el gimnasio no lo usa, su DNI. */}
        <div id="mi-qr" className="space-y-6 scroll-mt-4" data-bloque-qr>
        {qrPared && <EscanearEntrada gimnasioId={g.id} socioId={s.socio_id} principal={!debePagar} conSalida={registraSalida} />}
        {qr && (v.puede
          ? <MiQR gimnasioId={g.id} socioId={s.socio_id} inicial={qr} />
          : <QrBloqueado socioId={s.socio_id} titulo={faltaPagar ? "Tu QR se activa cuando pagues" : "Tu QR está bloqueado"}
              detalle={faltaPagar ? "Apenas pagues se prende solo: no hace falta recargar." : (v.texto ?? "Hoy no podés entrar.")} />)}
        {!qr && !qrPared && dni && (
          <section className="tarjeta p-6" data-tu-dni-inicio>
            <p className="texto-suave">Tu DNI para entrar</p>
            <p className="numero text-5xl mt-1">{formatearDni(dni)}</p>
          </section>
        )}

        </div>
        </>)}

        {/* D83 · 6: pocos botones grandes, los de todos los días. Sin pagar: lo que lo lleva a entrar (pagar, su QR bloqueado, clases, planes, su perfil, el gimnasio).
            Pagando: su QR, reservar, sus pagos, su perfil y el gimnasio. El resto (rutina, eventos, invitar…) sigue más abajo. */}
        <nav className="grid grid-cols-2 gap-3" aria-label="Lo de todos los días" data-botones-inicio data-modo-botones={faltaPagar ? "sin-pagar" : "pagando"}>
          {botonesInicio.map((b) => (
            <Link key={b.clave} href={b.href} prefetch={false} {...(b.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})} data-boton-inicio={b.clave}
              className={`tarjeta p-5 grid gap-2 min-h-[96px] content-center text-center active:scale-[0.98] transition ${b.principal ? "border-2" : ""}`} style={b.principal ? { borderColor: "var(--acento)" } : undefined}>
              <span className="text-3xl" aria-hidden><Icono nombre={b.icono} /></span><span className="titulo text-xl">{b.titulo}</span>
            </Link>
          ))}
        </nav>

        {progreso?.entro_hoy && <Entraste momento={progreso.entro_hoy} zona={zona} delMes={progreso.entradas_mes} racha={progreso.semanas_seguidas} hito={progreso.hito} />}
        {progreso && <ProgresoInicio p={progreso} />}
        <AvisosDelDia zona={yo.zona!} ofertas={ofertas} avisos={avisosDelDia} />
        <Recomendacion resumen={resumen} q={q} />

        {agenda && (agenda.cierres.length > 0 || agenda.sedes.some((x) => x.texto)) && (
          <section className="space-y-2" aria-label="Horarios del gimnasio" data-agenda-app>
            {agenda.sedes.filter((x) => x.texto).map((x) => (
              <p key={x.sede_id} className="flex items-center gap-2 texto-suave">
                <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: x.abierto ? "var(--verde)" : "var(--texto-tenue)" }} />
                {agenda.sedes.length > 1 ? `${x.sede}: ` : "Hoy: "}{x.texto}
              </p>
            ))}
            {agenda.cierres.slice(0, 3).map((c) => (
              <p key={`${c.desde}-${c.sede ?? ""}`} className="mensaje mensaje-aviso" data-cierre><Icono nombre="prohibido" /> Cerrado {textoCierre(c)}{c.sede ? ` (${c.sede})` : ""}: {c.motivo}</p>
            ))}
          </section>
        )}

        <Link href={`${raiz}?pagina=1`} className="boton w-full" data-ver-pagina-gimnasio prefetch={false}><Icono nombre="web" /> Ver la página del gimnasio</Link>
        <Link href={`/app/info${q}`} className="tarjeta flex items-center gap-3 px-5 py-4 min-h-[64px]" data-info-gimnasio-acceso>
          <span className="text-2xl" aria-hidden><Icono nombre="info" /></span>
          <span className="flex-1 min-w-0"><span className="block font-semibold">Info del gimnasio</span><span className="block texto-suave text-sm truncate">Horarios, reglamento, contacto y cómo llegar</span></span>
          <span aria-hidden className="texto-tenue">›</span>
        </Link>
        {encuesta.pendiente && <Encuesta socioId={s.socio_id} />}
        {grados.length > 0 && (
          <section className="space-y-2" data-grados-app={grados.length}>
            <p className="titulo text-2xl"><Icono nombre="pesa" /> Tu grado</p>
            {grados.map((a) => (
              <div key={a.actividad_id} className="tarjeta p-4">
                <p className="font-semibold">{a.actividad}: {a.actual?.nombre ?? "sin grado todavía"}</p>
                {a.proximo && <p className="texto-suave text-sm">Para {a.proximo.nombre}: {textoRequisitos(a)}{a.listo ? <> · <Icono nombre="ok" /> ya podés rendir</> : ""}</p>}
              </div>
            ))}
          </section>
        )}
        {eventos.length > 0 && (
          <EventosApp socioId={s.socio_id} eventos={eventos} />
        )}
        {documentos.pendientes.length > 0 && (
          <section className="space-y-3" data-para-firmar={documentos.pendientes.length}>
            <p className="titulo text-2xl"><Icono nombre="lapiz" /> Para firmar</p>
            {documentos.pendientes.map((d) => <Firmar key={d.documento_id} socioId={s.socio_id} doc={d} />)}
          </section>
        )}
        {!debePagar && bloquePago}

        {rutina && (
          <Link href={`/app/rutina${q}`} className="tarjeta flex items-center gap-3 px-5 py-4 min-h-[64px]" data-link-rutina>
            <span className="text-3xl" aria-hidden><Icono nombre="pesa" /></span>
            <span className="flex-1 min-w-0"><span className="block titulo text-xl">Mi rutina</span><span className="block texto-suave truncate">{rutina.nombre}</span></span>
            <span aria-hidden className="texto-tenue">›</span>
          </Link>
        )}
        {invitados && v.puede && <Invitar gimnasioId={g.id} socioId={s.socio_id} datos={invitados} />}
        {referido && !faltaPagar && <Referir datos={referido} />}   {/* D83: quien todavía no pagó ve lo que lo lleva a entrar, nada de invitar */}
        <Instalar />

        {yo.modo_clases !== "ninguno" && (
          <section>
            <div className="flex items-end justify-between mb-3">
              <h2 className="titulo text-3xl"><Icono nombre="calendario" /> {yo.modo_clases === "reserva" ? "Mis clases" : "Clases"}</h2>
              <Link href={`/app/clases${q}`} className="boton !min-h-11">{yo.modo_clases === "reserva" ? <><Icono nombre="mas" /> Reservar</> : <><Icono nombre="calendario" /> Ver horarios</>}</Link>
            </div>
            {yo.modo_clases !== "reserva" ? <p className="texto-suave">No hace falta reservar: vení directo.</p> : !yo.reservas?.length ? <p className="texto-suave">No tenés clases reservadas.</p> : (
              <ul className="space-y-2">{yo.reservas.map((r) => (
                <li key={r.reserva_id} className="tarjeta flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="icono" aria-hidden>{r.emoji ?? <><Icono nombre="calendario" /></>}</span>
                  <span className="flex-1 min-w-0"><span className="block font-semibold">{r.actividad}</span>
                    <span className="block text-sm texto-suave first-letter:uppercase">{hora(r.inicio)}{r.estado === "espera" ? ` · ${r.posicion}° en espera` : ""}</span></span>
                  <CancelarReserva reservaId={r.reserva_id} />
                </li>
              ))}</ul>
            )}
          </section>
        )}
        {!v.puede && !yo.transferencia && <Aviso emoji="mensaje" titulo="Pasá por recepción">Para ponerte al día, pagá en el mostrador.</Aviso>}
      </div>
    );
  });
}
