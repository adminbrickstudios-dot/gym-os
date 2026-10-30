import type { CSSProperties, ReactNode } from "react";
import { formatearPesos } from "@/lib/formato";
import { urlMarca, type LandingPublicada, type Marca, type PlanPublico, type Seccion, type Sede } from "@/lib/landing";
import { condicionesPlan, iniciales, linkWhatsapp, textoSobre, unidadPlan, variantesPlan } from "@/lib/landing-textos";

// La landing pública de un gimnasio. Todo lo que muestra sale de
// landing_publica(): textos, orden de las secciones, planes, precios,
// colores y logo. Acá no hay ningún texto de un gimnasio en particular.

function estiloMarca(m: Marca): CSSProperties {
  return {
    ["--acento" as string]: m.color_acento,
    ["--acento-texto" as string]: textoSobre(m.color_acento),
    ["--fondo" as string]: m.color_fondo,
    background: m.color_fondo,
  };
}

function Logo({ marca, grande = false }: { marca: Marca; grande?: boolean }) {
  const url = urlMarca(marca.logo_path);
  const tam = grande ? "size-20 text-3xl" : "size-10 text-base";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={`Logo de ${marca.nombre}`} className={`${tam} rounded-2xl object-cover`} />;
  }
  return (
    <span aria-hidden className={`${tam} rounded-2xl grid place-items-center font-bold`}
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

function TituloSeccion({ id, children }: { id: string; children: ReactNode }) {
  return <h2 id={id} className="text-3xl sm:text-4xl font-bold tracking-tight mb-8 scroll-mt-24">{children}</h2>;
}

function Bloque({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="px-4 py-14 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <TituloSeccion id={id}>{titulo}</TituloSeccion>
        {children}
      </div>
    </section>
  );
}

// ── Secciones ───────────────────────────────────────────────────────

function SobreNosotros({ s }: { s: Extract<Seccion, { tipo: "sobre_nosotros" }> }) {
  if (!s.contenido.texto?.trim()) return null;
  return (
    <Bloque id="quienes-somos" titulo={s.titulo}>
      <p className="text-xl sm:text-2xl leading-relaxed max-w-3xl texto-suave">{s.contenido.texto}</p>
    </Bloque>
  );
}

function Actividades({ s }: { s: Extract<Seccion, { tipo: "actividades" }> }) {
  const items = s.contenido.items ?? [];
  if (!items.length) return null;
  return (
    <Bloque id="actividades" titulo={s.titulo}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((a) => (
          <li key={a.nombre} className="tarjeta p-6">
            <p className="text-4xl mb-4" aria-hidden>{a.emoji || "💪"}</p>
            <p className="text-xl font-semibold">{a.nombre}</p>
            {a.descripcion && <p className="texto-suave mt-1">{a.descripcion}</p>}
          </li>
        ))}
      </ul>
    </Bloque>
  );
}

function TarjetaPlan({ p, whatsapp, mostrarPrecio }: { p: PlanPublico; whatsapp: string | null; mostrarPrecio: boolean }) {
  const condiciones = condicionesPlan(p);
  const variantes = mostrarPrecio ? variantesPlan(p) : [];
  const link = linkWhatsapp(whatsapp, `Hola! Me interesa el plan ${p.nombre}.`);
  return (
    <li className="tarjeta p-6 flex flex-col">
      <p className="text-xl font-semibold">{p.nombre}</p>
      {p.descripcion && <p className="texto-suave mt-1">{p.descripcion}</p>}
      {mostrarPrecio && p.precio != null && (
        <p className="mt-5">
          <span className="text-4xl font-bold tracking-tight">{formatearPesos(p.precio)}</span>
          <span className="texto-suave ml-2">{unidadPlan(p)}</span>
        </p>
      )}
      {variantes.map((v) => (
        <p key={v} className="mt-2 text-sm font-medium" style={{ color: "var(--acento)" }}>💸 {v}</p>
      ))}
      {condiciones.length > 0 && (
        <ul className="mt-4 mb-6 flex flex-wrap gap-2">
          {condiciones.map((c) => <li key={c} className="text-sm rounded-full px-3 py-1 bg-black/5">{c}</li>)}
        </ul>
      )}
      {link && <a href={link} target="_blank" rel="noopener noreferrer" className="boton mt-auto">Lo quiero</a>}
    </li>
  );
}

function Planes({ s, landing }: { s: Extract<Seccion, { tipo: "planes" }>; landing: LandingPublicada }) {
  if (!landing.planes.length) return null;
  return (
    <Bloque id="planes" titulo={s.titulo}>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {landing.planes.map((p) => (
          <TarjetaPlan key={p.nombre} p={p} whatsapp={landing.contacto.whatsapp} mostrarPrecio={landing.mostrar_precios} />
        ))}
      </ul>
    </Bloque>
  );
}

function Horarios({ s }: { s: Extract<Seccion, { tipo: "horarios" }> }) {
  const filas = s.contenido.filas ?? [];
  if (!filas.length) return null;
  return (
    <Bloque id="horarios" titulo={s.titulo}>
      <dl className="tarjeta divide-y divide-black/5 max-w-2xl">
        {filas.map((f) => (
          <div key={f.dias} className="flex justify-between gap-4 px-6 py-4 text-lg">
            <dt className="texto-suave">{f.dias}</dt>
            <dd className="font-semibold text-right">{f.horas}</dd>
          </div>
        ))}
      </dl>
    </Bloque>
  );
}

function Galeria({ s, nombre }: { s: Extract<Seccion, { tipo: "galeria" }>; nombre: string }) {
  const fotos = (s.contenido.fotos ?? []).map(urlMarca).filter((u): u is string => !!u);
  if (!fotos.length) return null;
  return (
    <Bloque id="galeria" titulo={s.titulo}>
      <ul className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        {fotos.map((u, i) => (
          <li key={u} className={i === 0 ? "col-span-2 row-span-2" : ""}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={`Foto ${i + 1} de ${nombre}`} loading="lazy" className="w-full h-full aspect-square object-cover rounded-2xl" />
          </li>
        ))}
      </ul>
    </Bloque>
  );
}

function Equipo({ s }: { s: Extract<Seccion, { tipo: "equipo" }> }) {
  const personas = s.contenido.personas ?? [];
  if (!personas.length) return null;
  return (
    <Bloque id="equipo" titulo={s.titulo}>
      <ul className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {personas.map((p) => {
          const foto = urlMarca(p.foto);
          return (
            <li key={p.nombre} className="tarjeta p-6 text-center">
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto} alt={p.nombre} className="size-20 rounded-full object-cover mx-auto" />
              ) : (
                <span aria-hidden className="size-20 rounded-full grid place-items-center mx-auto text-2xl font-bold bg-black/5">
                  {iniciales(p.nombre)}
                </span>
              )}
              <p className="font-semibold mt-4">{p.nombre}</p>
              {p.rol && <p className="texto-suave text-sm">{p.rol}</p>}
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
    <Bloque id="preguntas" titulo={s.titulo}>
      <div className="space-y-3 max-w-3xl">
        {items.map((q) => (
          <details key={q.pregunta} className="tarjeta group">
            <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-6 min-h-[64px] text-lg font-semibold">
              {q.pregunta}
              <span aria-hidden className="text-2xl transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="px-6 pb-6 texto-suave text-lg">{q.respuesta}</p>
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
    <Bloque id="ubicacion" titulo={s.titulo}>
      <ul className="grid gap-4 sm:grid-cols-2">
        {conDireccion.map((x) => (
          <li key={x.nombre} className="tarjeta p-6">
            <p className="text-3xl mb-3" aria-hidden>📍</p>
            {conDireccion.length > 1 && <p className="font-semibold">{x.nombre}</p>}
            <p className="text-lg">{x.direccion}</p>
            <div className="flex flex-wrap gap-3 mt-5">
              {x.mapa_url && <a href={x.mapa_url} target="_blank" rel="noopener noreferrer" className="boton">🗺️ Cómo llegar</a>}
              {x.telefono && <a href={`tel:${x.telefono}`} className="boton">📞 Llamar</a>}
            </div>
          </li>
        ))}
      </ul>
    </Bloque>
  );
}

function SeccionLanding({ s, landing }: { s: Seccion; landing: LandingPublicada }) {
  switch (s.tipo) {
    case "sobre_nosotros": return <SobreNosotros s={s} />;
    case "actividades": return <Actividades s={s} />;
    case "planes": return <Planes s={s} landing={landing} />;
    case "horarios": return <Horarios s={s} />;
    case "galeria": return <Galeria s={s} nombre={landing.marca.nombre} />;
    case "equipo": return <Equipo s={s} />;
    case "preguntas": return <Preguntas s={s} />;
    case "ubicacion": return <Ubicacion s={s} sedes={landing.sedes} />;
  }
}

// ── Página ──────────────────────────────────────────────────────────

export function LandingGimnasio({ landing }: { landing: LandingPublicada }) {
  const { marca, portada, contacto } = landing;
  const whatsapp = linkWhatsapp(contacto.whatsapp, contacto.mensaje_whatsapp);
  const hayPlanes = landing.planes.length > 0 && landing.secciones.some((s) => s.tipo === "planes");
  const accion = whatsapp ?? (hayPlanes ? "#planes" : contacto.email ? `mailto:${contacto.email}` : null);
  const foto = urlMarca(portada.foto_path);

  return (
    <div style={estiloMarca(marca)} className="min-h-dvh">
      <header className="sticky top-0 z-20 backdrop-blur bg-[color-mix(in_srgb,var(--fondo)_85%,transparent)]">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between gap-4">
          <a href="#" className="flex items-center gap-3 min-w-0">
            <Logo marca={marca} />
            <span className="font-bold text-lg truncate">{marca.nombre}</span>
          </a>
          {hayPlanes && <a href="#planes" className="hidden sm:inline-flex boton">Ver planes</a>}
        </div>
      </header>

      <section className="px-4 pt-10 pb-16 sm:pt-16 sm:pb-24">
        <div className="mx-auto max-w-5xl">
          {foto ? (
            <div className="relative overflow-hidden rounded-[28px] min-h-[420px] sm:min-h-[520px] flex items-end">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
              <div className="relative p-6 sm:p-12 text-white max-w-3xl">
                <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]">{portada.titulo}</h1>
                {portada.bajada && <p className="mt-5 text-lg sm:text-xl text-white/85">{portada.bajada}</p>}
                {accion && <BotonPrincipal href={accion} className="mt-8 px-8">{portada.boton_texto}</BotonPrincipal>}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl">
              <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.02]">{portada.titulo}</h1>
              {portada.bajada && <p className="mt-6 text-xl sm:text-2xl texto-suave leading-relaxed">{portada.bajada}</p>}
              <div className="mt-10 flex flex-wrap gap-3">
                {accion && <BotonPrincipal href={accion} className="px-8">{portada.boton_texto}</BotonPrincipal>}
                {hayPlanes && accion !== "#planes" && <a href="#planes" className="boton text-lg px-8">Ver planes</a>}
              </div>
            </div>
          )}
        </div>
      </section>

      <main>
        {landing.secciones.map((s) => <SeccionLanding key={s.tipo} s={s} landing={landing} />)}
      </main>

      <footer className="px-4 pt-10 pb-32 sm:pb-12 border-t border-black/5">
        <div className="mx-auto max-w-5xl flex flex-col sm:flex-row gap-6 sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Logo marca={marca} />
            <span className="font-semibold">{marca.nombre}</span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 texto-suave">
            {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="hover:underline">WhatsApp</a>}
            {contacto.instagram && (
              <a href={`https://instagram.com/${contacto.instagram}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                Instagram
              </a>
            )}
            {contacto.email && <a href={`mailto:${contacto.email}`} className="hover:underline">{contacto.email}</a>}
          </div>
        </div>
        <p className="mx-auto max-w-5xl mt-8 text-xs texto-suave">Página hecha con Gym OS</p>
      </footer>

      {whatsapp && (
        <div className="sm:hidden fixed inset-x-0 bottom-0 z-30 p-3 bg-[color-mix(in_srgb,var(--fondo)_92%,transparent)] backdrop-blur border-t border-black/5">
          <BotonPrincipal href={whatsapp} className="w-full">💬 {portada.boton_texto}</BotonPrincipal>
        </div>
      )}
    </div>
  );
}

export function LandingProximamente({ marca }: { marca: Marca }) {
  return (
    <div style={estiloMarca(marca)} className="min-h-dvh grid place-items-center px-4">
      <div className="text-center">
        <div className="flex justify-center"><Logo marca={marca} grande /></div>
        <h1 className="text-3xl font-bold mt-6">{marca.nombre}</h1>
        <p className="texto-suave mt-2 text-lg">Estamos preparando nuestra página. Volvé pronto.</p>
      </div>
    </div>
  );
}
