import type { ReactNode } from "react";
import { formatearPesos } from "@/lib/formato";
import type { EquipoPublico, EventoPublico, LandingPublicada, Marca, PlanPublico, Seccion, Sede } from "@/lib/landing";
import { urlMarca } from "@/lib/url-marca";
import { urlFotoProducto } from "@/lib/url-producto";
import { AnotarseEvento } from "./AnotarseEvento";
import { condicionesPlan, iniciales, linkWhatsapp, unidadPlan, variantesPlan } from "@/lib/landing-textos";
import { propsMarca } from "@/lib/marca";
import { resumirHorarios, textoCierre, type Agenda } from "@/lib/horarios";
import { conTextosPorDefecto } from "@/lib/landing-defaults";
import { FormProbar } from "./FormProbar";
import { Foto } from "./Foto";

// La landing pública de un gimnasio. Todo lo que muestra sale de
// landing_publica(): textos, orden de las secciones, planes, precios,
// colores y logo. Acá no hay ningún texto de un gimnasio en particular:
// solo el emoji de cada tipo de sección.

const EMOJI_SECCION: Record<Seccion["tipo"], string> = {
  sobre_nosotros: "🏋️",
  actividades: "💪",
  planes: "🔥",
  horarios: "⏰",
  galeria: "📸",
  equipo: "👥",
  preguntas: "💬",
  ubicacion: "📍",
  probar: "🙋",
};

function Logo({ marca, grande = false }: { marca: Marca; grande?: boolean }) {
  const url = urlMarca(marca.logo_path);
  const tam = grande ? "size-20 text-3xl rounded-3xl" : "size-10 text-base rounded-xl";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={`Logo de ${marca.nombre}`} className={`${tam} !w-auto max-w-40 object-contain`} />;
  }
  return (
    <span aria-hidden className={`${tam} grid place-items-center titulo`}
      style={{ background: "var(--acento)", color: "var(--acento-texto)" }}>
      {iniciales(marca.nombre)}
    </span>
  );
}

function BotonPrincipal({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  const externo = href.startsWith("http");
  return (
    <a href={href} className={`boton boton-principal text-lg ${className}`}
      {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}

function Bloque({ id, tipo, titulo, children }: { id: string; tipo: Seccion["tipo"]; titulo: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="px-4 py-12 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <h2 id={id} className="flex items-center gap-4 mb-8 sm:mb-10 scroll-mt-24">
          <span className="icono" aria-hidden>{EMOJI_SECCION[tipo]}</span>
          <span className="titulo text-4xl sm:text-5xl">{titulo}</span>
        </h2>
        {children}
      </div>
    </section>
  );
}

// ── Secciones ───────────────────────────────────────────────────────

function SobreNosotros({ s }: { s: Extract<Seccion, { tipo: "sobre_nosotros" }> }) {
  if (!s.contenido.texto?.trim()) return null;
  return (
    <Bloque id="quienes-somos" tipo={s.tipo} titulo={s.titulo}>
      <p className="text-xl sm:text-2xl leading-relaxed max-w-[38ch] sm:max-w-[48ch] texto-suave">{s.contenido.texto}</p>
    </Bloque>
  );
}

function Actividades({ s }: { s: Extract<Seccion, { tipo: "actividades" }> }) {
  const items = s.contenido.items ?? [];
  if (!items.length) return null;
  return (
    <Bloque id="actividades" tipo={s.tipo} titulo={s.titulo}>
      <ul className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {items.map((a, i) => (
          <li key={`${i}-${a.nombre}`} className="tarjeta p-5 sm:p-6">
            <p className="text-4xl sm:text-5xl mb-5" aria-hidden>{a.emoji || "💪"}</p>
            <p className="titulo text-2xl">{a.nombre}</p>
            {a.descripcion && <p className="texto-suave mt-1.5 text-[15px] leading-snug">{a.descripcion}</p>}
          </li>
        ))}
      </ul>
    </Bloque>
  );
}

function TarjetaPlan({ p, whatsapp, mostrarPrecio, altas }: { p: PlanPublico; whatsapp: string | null; mostrarPrecio: boolean; altas: boolean }) {
  const condiciones = condicionesPlan(p);
  const variantes = mostrarPrecio ? variantesPlan(p) : [];
  const link = linkWhatsapp(whatsapp, `Hola! Me interesa el plan ${p.nombre}.`);
  return (
    <li className="tarjeta p-6 flex flex-col">
      <p className="titulo text-2xl">{p.nombre}</p>
      {p.descripcion && <p className="texto-suave mt-1">{p.descripcion}</p>}
      {mostrarPrecio && p.precio != null && (
        <p className="mt-6 flex items-baseline gap-2 flex-wrap">
          <span className="numero text-5xl sm:text-6xl">{formatearPesos(p.precio)}</span>
          <span className="texto-suave">{unidadPlan(p)}</span>
        </p>
      )}
      {variantes.map((v) => (
        <p key={v} className="mt-2 text-sm font-semibold" style={{ color: "var(--acento)" }}>💸 {v}</p>
      ))}
      {condiciones.length > 0 && (
        <ul className="mt-5 flex flex-wrap gap-2">
          {condiciones.map((c) => <li key={c} className="pildora">{c}</li>)}
        </ul>
      )}
      {altas && p.id
        ? <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={`/hacete-socio?plan=${p.id}`} className="boton">💪 Elegir este</a>
            {link && <a href={link} target="_blank" rel="noopener noreferrer" className="texto-suave underline underline-offset-4">Consultar</a>}
          </div>
        : link && <a href={link} target="_blank" rel="noopener noreferrer" className="boton mt-8">Lo quiero</a>}
    </li>
  );
}

function Planes({ s, landing }: { s: Extract<Seccion, { tipo: "planes" }>; landing: LandingPublicada }) {
  if (!landing.planes.length) return null;
  return (
    <Bloque id="planes" tipo={s.tipo} titulo={s.titulo}>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {landing.planes.map((p) => (
          <TarjetaPlan key={p.id ?? p.nombre} p={p} whatsapp={landing.contacto.whatsapp} mostrarPrecio={landing.mostrar_precios} altas={!!landing.altas_online} />
        ))}
      </ul>
    </Bloque>
  );
}

/** "🟢 Abierto · cierra 22:00": la misma cuenta que la app y el panel (privado.agenda). */
function EstadoAhora({ texto, abierto }: { texto: string | null; abierto: boolean }) {
  if (!texto) return null;
  return (
    <span className={`pildora ${abierto ? "pildora-verde" : ""}`} data-abierto={abierto}>
      <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: abierto ? "var(--verde)" : "var(--texto-tenue)" }} />
      {texto}
    </span>
  );
}

function Horarios({ s, agenda }: { s: Extract<Seccion, { tipo: "horarios" }>; agenda: Agenda | null }) {
  // Con horarios cargados en el panel, salen de ahí (y dicen si está abierto); si no, el texto libre de la sección.
  const sedes = (agenda?.sedes ?? []).filter((x) => x.franjas.length);
  const filas = s.contenido.filas ?? [];
  if (!sedes.length && !filas.length) return null;
  return (
    <Bloque id="horarios" tipo={s.tipo} titulo={s.titulo}>
      {sedes.length ? (
        <div className="grid gap-4 md:grid-cols-2 max-w-4xl">
          {sedes.map((x) => (
            <div key={x.sede_id} className="tarjeta" data-horarios-sede={x.sede}>
              {(sedes.length > 1 || x.texto) && (
                <div className="flex flex-wrap items-center justify-between gap-2 px-6 pt-5">
                  {sedes.length > 1 && <p className="titulo text-2xl">📍 {x.sede}</p>}
                  <EstadoAhora texto={x.texto} abierto={x.abierto} />
                </div>
              )}
              <dl className="divide-y divide-[var(--borde)]">
                {resumirHorarios(x.franjas).map((f) => (
                  <div key={f.dias} className="flex justify-between items-baseline gap-4 px-6 py-4">
                    <dt className="texto-suave text-lg">{f.dias}</dt>
                    <dd className={`text-right ${f.horas === "Cerrado" ? "texto-tenue" : "numero text-xl"}`}>{f.horas}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <dl className="tarjeta max-w-2xl divide-y divide-[var(--borde)]">
          {filas.map((f) => (
            <div key={f.dias} className="flex justify-between items-baseline gap-4 px-6 py-5">
              <dt className="texto-suave text-lg">{f.dias}</dt>
              <dd className="numero text-2xl text-right">{f.horas}</dd>
            </div>
          ))}
        </dl>
      )}
    </Bloque>
  );
}

/** Los próximos cierres, arriba de todo: que nadie viaje al gimnasio cerrado. */
function AvisoCierres({ agenda }: { agenda: Agenda | null }) {
  const cierres = agenda?.cierres ?? [];
  if (!cierres.length) return null;
  return (
    <div className="px-4 pt-3">
      <ul className="mx-auto max-w-5xl space-y-2" aria-label="Días que cierra el gimnasio">
        {cierres.slice(0, 3).map((c) => (
          <li key={`${c.desde}-${c.sede ?? ""}`} className="mensaje mensaje-aviso" data-cierre>
            🚫 Cerrado {textoCierre(c)}{c.sede ? ` (${c.sede})` : ""}: {c.motivo}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Galeria({ s, nombre }: { s: Extract<Seccion, { tipo: "galeria" }>; nombre: string }) {
  const fotos = (s.contenido.fotos ?? []).map(urlMarca).filter((u): u is string => !!u);
  if (!fotos.length) return null;
  return (
    <Bloque id="galeria" tipo={s.tipo} titulo={s.titulo}>
      <ul className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        {fotos.map((u, i) => (
          <li key={u} className={`relative overflow-hidden rounded-[var(--radio)] aspect-square ${i === 0 ? "col-span-2 row-span-2" : ""}`}>
            <Foto src={u} alt={`Foto ${i + 1} de ${nombre}`} sizes={i === 0 ? "(min-width: 1024px) 66vw, 100vw" : "(min-width: 1024px) 33vw, 50vw"} />
          </li>
        ))}
      </ul>
    </Bloque>
  );
}

// VD-44: además de las personas que escribe el dueño en el editor, las del equipo real que él tildó
// (foto servida por /foto-equipo, que la base autoriza; con las clases que da).
function Equipo({ s, reales }: { s: Extract<Seccion, { tipo: "equipo" }>; reales: EquipoPublico[] }) {
  const manuales = (s.contenido.personas ?? []).map((p) => ({ nombre: p.nombre, rol: p.rol, foto: urlMarca(p.foto), real: false, detalle: null as string | null }));
  const delEquipo = reales.map((p) => ({ nombre: p.nombre, rol: p.rol, foto: p.tiene_foto ? `/foto-equipo/${p.equipo_id}` : null, real: true,
    detalle: p.actividades.length ? p.actividades.join(" · ") : null }));
  const personas = [...manuales, ...delEquipo];
  if (!personas.length) return null;
  return (
    <Bloque id="equipo" tipo={s.tipo} titulo={s.titulo}>
      <ul className="grid gap-3 grid-cols-2 lg:grid-cols-4" data-equipo-publico>
        {personas.map((p, i) => {
          const foto = p.foto;
          return (
            <li key={`${i}-${p.nombre}`} className="tarjeta p-5 sm:p-6" {...(p.real ? { "data-persona-equipo": p.nombre } : {})}>
              {foto ? (
                <span className="relative block size-16 rounded-2xl overflow-hidden"><Foto src={foto} alt={p.nombre} sizes="64px" /></span>
              ) : (
                <span aria-hidden className="size-16 rounded-2xl grid place-items-center titulo text-2xl bg-[var(--tarjeta-alta)]">
                  {iniciales(p.nombre)}
                </span>
              )}
              <p className="titulo text-xl mt-5">{p.nombre}</p>
              {p.rol && <p className="texto-suave text-[15px]">{p.rol}</p>}
              {p.detalle && <p className="texto-tenue text-sm mt-1">{p.detalle}</p>}
            </li>
          );
        })}
      </ul>
    </Bloque>
  );
}

function Preguntas({ s }: { s: Extract<Seccion, { tipo: "preguntas" }> }) {
  const items = s.contenido.items ?? [];
  if (!items.length) return null;
  return (
    <Bloque id="preguntas" tipo={s.tipo} titulo={s.titulo}>
      <div className="space-y-2 max-w-3xl">
        {items.map((q, i) => (
          <details key={`${i}-${q.pregunta}`} className="tarjeta group">
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-6 min-h-[64px] text-lg font-semibold">
              {q.pregunta}
              <span aria-hidden className="text-2xl texto-suave transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="px-6 pb-6 texto-suave text-lg leading-relaxed">{q.respuesta}</p>
          </details>
        ))}
      </div>
    </Bloque>
  );
}

function Ubicacion({ s, sedes }: { s: Extract<Seccion, { tipo: "ubicacion" }>; sedes: Sede[] }) {
  const conDireccion = sedes.filter((x) => x.direccion);
  if (!conDireccion.length) return null;
  return (
    <Bloque id="ubicacion" tipo={s.tipo} titulo={s.titulo}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {conDireccion.map((x) => (
          <li key={x.nombre} className="tarjeta p-6">
            {conDireccion.length > 1 && <p className="titulo text-xl mb-1">{x.nombre}</p>}
            <p className="text-xl">{x.direccion}</p>
            <div className="flex flex-wrap gap-2 mt-6">
              {x.mapa_url && <a href={x.mapa_url} target="_blank" rel="noopener noreferrer" className="boton">🗺️ Cómo llegar</a>}
              {x.telefono && <a href={`tel:${x.telefono}`} className="boton">📞 Llamar</a>}
            </div>
          </li>
        ))}
      </ul>
    </Bloque>
  );
}

function SeccionLanding({ s, landing, agenda }: { s: Seccion; landing: LandingPublicada; agenda: Agenda | null }) {
  switch (s.tipo) {
    case "sobre_nosotros": return <SobreNosotros s={s} />;
    case "actividades": return <Actividades s={s} />;
    case "planes": return <Planes s={s} landing={landing} />;
    case "horarios": return <Horarios s={s} agenda={agenda} />;
    case "galeria": return <Galeria s={s} nombre={landing.marca.nombre} />;
    case "equipo": return <Equipo s={s} reales={landing.equipo_publico ?? []} />;
    case "preguntas": return <Preguntas s={s} />;
    case "ubicacion": return <Ubicacion s={s} sedes={landing.sedes} />;
    case "probar": return (
      <Bloque id="probar" tipo={s.tipo} titulo={s.titulo}>
        <div className="max-w-xl space-y-6">
          {s.contenido.texto && <p className="text-lg texto-suave">{s.contenido.texto}</p>}
          <FormProbar />
        </div>
      </Bloque>
    );
  }
}

// ── Página ──────────────────────────────────────────────────────────

/** COM-8: los eventos que vienen, con fecha, precio y lugares. Se anotan escribiendo o en recepción. */
function Eventos({ eventos, whatsapp }: { eventos: EventoPublico[]; whatsapp: string | null }) {
  const cuando = (m: string, zona: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  return (
    <section aria-labelledby="eventos" className="px-4 py-12 sm:py-20" data-eventos-landing={eventos.length}>
      <div className="mx-auto max-w-5xl">
        <h2 id="eventos" className="flex items-center gap-4 mb-8 sm:mb-10 scroll-mt-24">
          <span className="icono" aria-hidden>🎟️</span>
          <span className="titulo text-4xl sm:text-5xl">Próximos eventos</span>
        </h2>
        <ul className="grid sm:grid-cols-2 gap-4">
          {eventos.map((e) => (
            <li key={e.evento_id} className="tarjeta p-6 space-y-2" data-evento-pagina={e.nombre}>
              {e.flyer && urlFotoProducto(e.flyer) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urlFotoProducto(e.flyer)!} alt={`Flyer de ${e.nombre}`} className="w-full aspect-[4/3] rounded-[var(--radio)] object-cover" loading="lazy" decoding="async" />
              )}
              <p className="titulo text-2xl">{e.nombre}</p>
              <p className="texto-suave first-letter:uppercase">{cuando(e.inicio, e.zona)}{e.fechas && e.fechas.length > 1 ? ` · y ${e.fechas.length - 1} fecha${e.fechas.length > 2 ? "s" : ""} más` : ""}</p>
              {(e.lugar || e.responsable) && <p className="texto-suave">{[e.lugar && `📍 ${e.lugar}`, e.responsable && `👤 ${e.responsable}`].filter(Boolean).join(" · ")}</p>}
              {e.descripcion && <p>{e.descripcion}</p>}
              <p className="flex flex-wrap items-center gap-3 pt-2">
                <span className="numero text-3xl">{Number(e.precio) > 0 ? formatearPesos(e.precio) : "Gratis"}</span>
                {e.precio_socio != null && Number(e.precio) > 0 && Number(e.precio_socio) < Number(e.precio) && <span className="pildora pildora-verde">Socios {formatearPesos(e.precio_socio)}</span>}
                <span className={`pildora ${e.quedan === 0 ? "pildora-rojo" : ""}`}>{e.quedan === 0 ? "Sin lugares" : `Quedan ${e.quedan} ${e.quedan === 1 ? "lugar" : "lugares"}`}</span>
                {e.para === "socios" && <span className="pildora">Para socios</span>}
              </p>
              {e.para === "todos"
                ? <AnotarseEvento eventoId={e.evento_id} lleno={e.quedan === 0} conEspera={e.lista_espera !== false} />
                : <p className="texto-suave">Anotate desde la app del gimnasio.</p>}
              {e.quedan > 0 && whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="boton mt-2">💬 Consultar por WhatsApp</a>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** VD-25: lo primero que se ve después del título: abierto ahora, reseñas y socios. Solo lo que el dueño prendió. */
function Senales({ landing, ahora }: { landing: LandingPublicada; ahora: Agenda["sedes"][number] | null }) {
  const ps = landing.prueba_social;
  const resena = ps?.resena ?? null;
  const socios = ps?.socios ?? null;
  const estado = ahora?.texto ? ahora : null;
  if (!estado && !resena && !socios) return null;
  const puntaje = resena ? Number(resena.puntaje).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "";
  const contenidoResena = resena && (
    <>
      <span aria-hidden className="text-[#f5b50a]">★</span>
      <span className="numero">{puntaje}</span>
      <span>· {resena.cantidad.toLocaleString("es-AR")} {resena.cantidad === 1 ? "reseña" : "reseñas"} en Google</span>
    </>
  );
  return (
    <ul className="mt-5 flex flex-wrap items-center gap-2" data-prueba-social>
      {estado && <li><EstadoAhora texto={estado.texto} abierto={estado.abierto} /></li>}
      {resena && (
        <li>
          {resena.link
            ? <a href={resena.link} target="_blank" rel="noopener noreferrer" className="pildora" data-resenas>{contenidoResena}</a>
            : <span className="pildora" data-resenas>{contenidoResena}</span>}
        </li>
      )}
      {socios && <li><span className="pildora" data-socios>👥 +{socios.toLocaleString("es-AR")} socios</span></li>}
    </ul>
  );
}

/** VD-25: tres pasos para el que nunca vino. Salen de lo que la página tiene prendido (probar, planes, altas). */
function ComoEmpezar({ probar, planes, altas }: { probar: boolean; planes: boolean; altas: boolean }) {
  const pasos = [
    probar && { href: "#probar", titulo: "Probá una clase", texto: "Dejás tu WhatsApp y te escribimos para arreglar día y hora." },
    planes && { href: "#planes", titulo: "Elegí tu plan", texto: "Mirá los precios y quedate con el que te cierra." },
    altas && { href: "/hacete-socio", titulo: "Hacete socio", texto: "Te anotás desde el celular y empezás." },
  ].filter(Boolean) as { href: string; titulo: string; texto: string }[];
  if (pasos.length < 2) return null;
  return (
    <section aria-labelledby="empezar" className="px-4 pt-4 pb-2" data-como-empezar>
      <div className="mx-auto max-w-5xl">
        <h2 id="empezar" className="titulo text-2xl sm:text-3xl mb-4">🚀 ¿Primera vez? Empezá acá</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {pasos.map((p, i) => (
            <li key={p.titulo}>
              <a href={p.href} className="tarjeta p-5 flex gap-4 items-start h-full">
                <span aria-hidden className="numero text-3xl" style={{ color: "var(--acento)" }}>{i + 1}</span>
                <span><span className="titulo text-xl block">{p.titulo}</span><span className="texto-suave text-[15px] leading-snug">{p.texto}</span></span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function LandingGimnasio({ landing: landingCargada, agenda = null, eventos = [] }: { landing: LandingPublicada; agenda?: Agenda | null; eventos?: EventoPublico[] }) {
  // VD-62: lo que el dueño no cargó se completa con un texto sensato según el tipo de gimnasio (nunca un hueco).
  const landing = conTextosPorDefecto(landingCargada);
  const { marca, portada, contacto } = landing;
  const video = portada.video_url ?? null;
  const whatsapp = linkWhatsapp(contacto.whatsapp, contacto.mensaje_whatsapp);
  const hayPlanes = landing.planes.length > 0 && landing.secciones.some((s) => s.tipo === "planes");
  const hayProbar = landing.secciones.some((s) => s.tipo === "probar");
  const accion = whatsapp ?? (hayPlanes ? "#planes" : contacto.email ? `mailto:${contacto.email}` : null);
  const foto = urlMarca(portada.foto_path);
  // "Abierto ahora" en la portada solo con una sede (con varias, va en Horarios, por sede).
  const ahora = agenda?.sedes.length === 1 ? agenda.sedes[0] : null;

  return (
    <div {...propsMarca(marca)} className="min-h-dvh">
      <header className="sticky top-0 z-20 backdrop-blur-md bg-[color-mix(in_oklab,var(--fondo)_80%,transparent)]">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-4">
          <a href="#" className="flex items-center gap-3 min-w-0">
            <Logo marca={marca} />
            <span className="titulo text-xl truncate">{marca.nombre}</span>
          </a>
          <nav className="flex gap-2 shrink-0" aria-label="Accesos">
            {landing.altas_online && <a href="/hacete-socio" className="hidden sm:inline-flex boton">💪 Hacete socio</a>}
            {hayPlanes && <a href="#planes" className="hidden sm:inline-flex boton">🔥 Ver planes</a>}
            <a href="/ingresar?modo=socio" className="boton">💪 Soy socio</a>
          </nav>
        </div>
      </header>
      <AvisoCierres agenda={agenda} />

      {foto || video ? (
        <section className="px-4 pt-4 pb-6">
          <div className="mx-auto max-w-5xl relative overflow-hidden rounded-[var(--radio-grande)] min-h-[72dvh] sm:min-h-[560px] flex items-end bg-neutral-900" data-portada={video ? "video" : "foto"}>
            {foto && <Foto src={foto} alt="" prioridad sizes="(min-width: 1024px) 1024px, 100vw" />}
            {/* Video mudo y en bucle sobre la foto (que hace de póster). Con "reducir movimiento" no se muestra: queda la foto. */}
            {video && (
              <video className="video-portada absolute inset-0 w-full h-full object-cover" src={video} poster={foto ?? undefined}
                autoPlay muted loop playsInline preload={foto ? "none" : "metadata"} aria-hidden tabIndex={-1} data-video-portada />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
            <div className="relative p-6 sm:p-12 text-white aparecer">
              <h1 className="titular text-[clamp(3.25rem,13vw,7.5rem)] max-w-[12ch]">{portada.titulo}</h1>
              {portada.bajada && <p className="mt-5 text-lg sm:text-2xl text-white/90 max-w-[36ch]">{portada.bajada}</p>}
              <Senales landing={landing} ahora={ahora} />
              <div className="mt-8 flex flex-wrap gap-3">
                {hayProbar && <a href="#probar" className="boton boton-principal text-lg px-8" data-probar-gratis>🎁 Probá gratis</a>}
                {accion && <BotonPrincipal href={accion} className={`px-8 ${hayProbar ? "!bg-white/15 !text-white !border-white/30" : ""} ${whatsapp ? "hidden sm:inline-flex" : ""}`}>{whatsapp ? "💬 " : ""}{portada.boton_texto}</BotonPrincipal>}
                {landing.altas_online && <a href="/hacete-socio" className="boton text-lg px-8 bg-white/15 text-white border-white/30">💪 Hacete socio</a>}
              </div>
            </div>
          </div>
        </section>
      ) : (
        <section className="px-4 pt-14 pb-10 sm:pt-28 sm:pb-20">
          <div className="mx-auto max-w-5xl">
            <h1 className="titular text-[clamp(3.5rem,15vw,8.5rem)] max-w-[11ch]">{portada.titulo}</h1>
            {portada.bajada && <p className="mt-6 sm:mt-8 text-xl sm:text-2xl texto-suave leading-snug max-w-[34ch]">{portada.bajada}</p>}
            <Senales landing={landing} ahora={ahora} />
            <div className="mt-10 flex flex-wrap gap-3">
              {/* En el celular, con WhatsApp, el botón principal es la barra fija de abajo: no se repite. */}
              {hayProbar && <a href="#probar" className="boton boton-principal text-lg px-8 w-full sm:w-auto" data-probar-gratis>🎁 Probá gratis</a>}
              {accion && <BotonPrincipal href={accion} className={`px-8 w-full sm:w-auto ${hayProbar ? "!bg-transparent !text-[var(--texto)] !border-[var(--borde)]" : ""} ${whatsapp ? "hidden sm:inline-flex" : ""}`}>{whatsapp ? "💬 " : ""}{portada.boton_texto}</BotonPrincipal>}
              {landing.altas_online && <a href="/hacete-socio" className="boton text-lg px-8 w-full sm:w-auto">💪 Hacete socio</a>}
              {hayPlanes && accion !== "#planes" && <a href="#planes" className="boton text-lg px-8 w-full sm:w-auto">🔥 Ver planes</a>}
            </div>
          </div>
        </section>
      )}

      <main>
        <ComoEmpezar probar={hayProbar} planes={hayPlanes} altas={!!landing.altas_online} />
        {landing.secciones.map((s) => <SeccionLanding key={s.tipo} s={s} landing={landing} agenda={agenda} />)}
        {/* VD-44: si el dueño no armó la sección Equipo pero mostró a su gente, aparece igual. */}
        {(landing.equipo_publico?.length ?? 0) > 0 && !landing.secciones.some((s) => s.tipo === "equipo") && (
          <Equipo s={{ tipo: "equipo", titulo: "Nuestro equipo", contenido: {} }} reales={landing.equipo_publico ?? []} />
        )}
        {eventos.length > 0 && <Eventos eventos={eventos} whatsapp={whatsapp} />}
      </main>

      <footer className="px-4 pt-12 pb-32 sm:pb-14 mt-8 border-t border-[var(--borde)]">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row gap-6 sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Logo marca={marca} />
            <span className="titulo text-xl">{marca.nombre}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="boton">💬 WhatsApp</a>}
            {contacto.instagram && (
              <a href={`https://instagram.com/${contacto.instagram}`} target="_blank" rel="noopener noreferrer" className="boton">📷 Instagram</a>
            )}
            {contacto.email && <a href={`mailto:${contacto.email}`} className="boton">✉️ Mail</a>}
            {landing.prueba_social?.resena?.link && <a href={landing.prueba_social.resena.link} target="_blank" rel="noopener noreferrer" className="boton">⭐ Dejanos tu reseña</a>}
          </div>
        </div>
        <div className="mx-auto max-w-5xl mt-10 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm texto-tenue">Página hecha con Base</p>
          <a href="/ingresar" className="text-sm texto-suave underline underline-offset-4">🛎️ Soy del equipo</a>
        </div>
      </footer>

      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="Escribinos por WhatsApp" data-whatsapp-flotante
          className="hidden sm:grid fixed right-6 bottom-6 z-30 size-14 place-items-center rounded-full text-2xl shadow-lg"
          style={{ background: "var(--acento)", color: "var(--acento-texto)" }}>💬</a>
      )}
      {whatsapp && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-30 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-[color-mix(in_oklab,var(--fondo)_88%,transparent)] backdrop-blur-md">
          <BotonPrincipal href={whatsapp} className="w-full">💬 {portada.boton_texto}</BotonPrincipal>
        </div>
      )}
    </div>
  );
}

export function LandingProximamente({ marca, contacto }: { marca: Marca; contacto?: { whatsapp: string | null; mensaje_whatsapp: string | null } }) {
  const whatsapp = linkWhatsapp(contacto?.whatsapp ?? null, contacto?.mensaje_whatsapp || "Hola! Vi su página.");
  return (
    <div {...propsMarca(marca)} className="min-h-dvh grid place-items-center px-4">
      <div className="text-center">
        <div className="flex justify-center"><Logo marca={marca} grande /></div>
        <h1 className="titular text-5xl sm:text-6xl mt-8">{marca.nombre}</h1>
        <p className="texto-suave mt-4 text-lg">🚧 Estamos armando nuestra página. Volvé pronto.</p>
        {whatsapp && <div className="mt-8 flex justify-center"><BotonPrincipal href={whatsapp} className="px-8">💬 Escribinos por WhatsApp</BotonPrincipal></div>}
        <div className="mt-10 flex flex-wrap justify-center gap-2">
          <a href="/ingresar?modo=socio" className="boton">💪 Soy socio</a>
          <a href="/ingresar" className="boton">🛎️ Soy del equipo</a>
        </div>
      </div>
    </div>
  );
}
