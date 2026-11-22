// Vuelta final (Mateo, 22/11) · la página nueva del gimnasio, detrás de la llave `landing_nueva` (apagada en los gimnasios reales,
// prendida en los [demo]). Que se sienta un gimnasio y no un sistema: los dibujos propios de Pase en el color del gimnasio, sin fotos.
// El orden lo pidió Mateo: 1) nombre, en qué es fuerte y "Hacete socio"; 2) planes y precios, y las clases de la semana;
// 3) cómo llegar, horarios y WhatsApp; 4) reglamento y "Ya soy socio". Todo sale de landing_publica(): lo que falta no se muestra.
import { formatearPesos } from "@/lib/formato";
import type { ClaseSemana, LandingPublicada } from "@/lib/landing";
import { linkWhatsapp } from "@/lib/landing-textos";
import { propsMarca } from "@/lib/marca";
import { resumirHorarios, type Agenda } from "@/lib/horarios";
import { conTextosPorDefecto } from "@/lib/landing-defaults";
import { estiloTipografia } from "@/lib/landing-estilo";
import { Icono } from "@/components/ui/Icono";
import { NOMBRE_PRODUCTO } from "@/lib/producto";
import { Barra, Banco, Cronometro, Kettlebell, LineaPista, Mancuerna, Soga } from "@/components/ilustraciones/Gimnasio";
import { AvisoCierres, ClasesSemana, EstadoAhora, Logo, TarjetaPlan, type SesionLanding } from "./Landing";

/** En qué es fuerte: las actividades que cargó el dueño (hasta 4). Sin actividades, nada. */
export function fuertesDe(landing: LandingPublicada): string[] {
  const act = landing.secciones.find((s) => s.tipo === "actividades");
  const items = act && act.tipo === "actividades" ? act.contenido.items ?? [] : [];
  return items.map((i) => i.nombre?.trim()).filter((n): n is string => !!n).slice(0, 4);
}

/** El precio más bajo que se puede mostrar ("desde $X"), solo si el dueño muestra precios. */
export function precioDesde(landing: LandingPublicada): number | null {
  if (!landing.mostrar_precios) return null;
  const precios = landing.planes.map((p) => (p.precio == null ? NaN : Number(p.precio))).filter((n) => Number.isFinite(n) && n > 0);
  return precios.length ? Math.min(...precios) : null;
}

function Titulo({ id, children, dibujo }: { id: string; children: string; dibujo?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6 mb-8">
      <h2 id={id} className="titular text-[clamp(2.25rem,8vw,3.5rem)] leading-none scroll-mt-24">{children}</h2>
      {dibujo && <span className="hidden sm:block shrink-0 texto-tenue">{dibujo}</span>}
    </div>
  );
}

export function LandingNueva({ landing: cargada, agenda = null, clases = [], sesion = null }: {
  landing: LandingPublicada & { tiene_terminos?: boolean }; agenda?: Agenda | null; clases?: ClaseSemana[]; sesion?: SesionLanding;
}) {
  const landing = conTextosPorDefecto(cargada);
  const { marca, portada, contacto } = landing;
  const whatsapp = linkWhatsapp(contacto.whatsapp, contacto.mensaje_whatsapp);
  const altas = landing.crear_cuenta ?? !!landing.altas_online;
  const fuertes = fuertesDe(landing);
  const desde = precioDesde(landing);
  const titulo = portada.titulo?.trim() ?? "";
  const frase = (titulo && titulo.toLowerCase() !== marca.nombre.trim().toLowerCase() ? titulo : "") || portada.bajada || null;
  const sedes = (landing.sedes ?? []).filter((s) => s.direccion);
  const horarios = (agenda?.sedes ?? []).filter((x) => x.franjas.length);
  const hayPlanes = landing.planes.length > 0;
  const hayLlegar = sedes.length > 0 || horarios.length > 0 || !!whatsapp;
  const base = propsMarca(marca);

  // El botón grande: con altas, "Hacete socio"; sin altas, el WhatsApp; con sesión, su perfil. Nunca un botón que no hace nada.
  const principal = sesion
    ? { href: sesion.esSocio ? "/app" : "/panel", texto: sesion.esSocio ? "Ir a mi perfil" : "Ir al panel", icono: "persona", externo: false }
    : altas ? { href: "/hacete-socio", texto: "Hacete socio", icono: "mas", externo: false }
    : whatsapp ? { href: whatsapp, texto: "Escribinos por WhatsApp", icono: "mensaje", externo: true }
    : null;

  return (
    <div {...base} style={{ ...base.style, ...estiloTipografia(marca.tipografia) }} className="min-h-dvh overflow-x-clip" data-pagina-gimnasio data-landing-nueva>
      <AvisoCierres agenda={agenda} />

      {/* 1 · Arriba: el nombre, en qué es fuerte y "Hacete socio". La pista y la barra acompañan desde atrás, nunca tapan el texto. */}
      <header className="relative isolate px-5 pt-8 pb-16 sm:pt-12 sm:pb-24" data-primer-pantallazo data-portada="ilustrada">
        <LineaPista className="absolute inset-x-0 bottom-0 -z-10 h-40 sm:h-64 w-full texto-tenue opacity-60" />
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3"><Logo marca={marca} /><span className="sr-only">{marca.nombre}</span></div>
          <div className="mt-10 grid gap-10 md:grid-cols-[1.2fr_1fr] md:items-end">
            <div>
              <h1 className="titular text-[clamp(3.25rem,14vw,6.5rem)] leading-[0.9] break-words" data-nombre-gimnasio>{marca.nombre}</h1>
              {frase && <p data-frase className="mt-5 text-xl sm:text-2xl leading-snug texto-suave max-w-[34ch]">{frase}</p>}
              {fuertes.length > 0 && (
                <ul className="mt-6 flex flex-wrap gap-2" data-fuertes aria-label="Lo que se entrena">
                  {fuertes.map((f) => <li key={f} className="pildora text-base">{f}</li>)}
                </ul>
              )}
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                {principal && (
                  <a href={principal.href} className="boton boton-principal text-xl px-9 !min-h-16" data-hacete-socio
                    {...(principal.externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                    <Icono nombre={principal.icono as "mas"} /> {principal.texto}
                  </a>
                )}
                {!sesion && <a href="/ingresar?modo=socio" className="boton text-lg px-8 !min-h-16" data-ya-soy-socio><Icono nombre="llave" /> Ya soy socio</a>}
              </div>
              {desde != null && hayPlanes && <p className="mt-4 texto-suave" data-precio-desde>Planes desde <a href="#planes" className="numero underline underline-offset-4">{formatearPesos(desde)}</a></p>}
            </div>
            <div className="relative flex items-end justify-center md:justify-end gap-4 max-w-md md:max-w-none mx-auto md:mx-0 w-full" aria-hidden>
              <Barra className="w-[78%] max-w-[22rem] texto-suave" />
              <Kettlebell className="w-[18%] max-w-[5rem] texto-suave mb-1" />
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* 2 · Planes y precios, y las clases de la semana (si el gimnasio tiene clases). */}
        {(hayPlanes || clases.length > 0) && (
          <section aria-labelledby="planes" className="px-5 py-14 sm:py-20" data-seccion="planes">
            <div className="mx-auto max-w-5xl">
              {hayPlanes && (
                <>
                  <Titulo id="planes" dibujo={<Mancuerna className="w-28" />}>Planes y precios</Titulo>
                  <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {landing.planes.map((p) => (
                      <TarjetaPlan key={p.id ?? p.nombre} p={p} whatsapp={contacto.whatsapp} mostrarPrecio={landing.mostrar_precios} altas={!!landing.altas_online} />
                    ))}
                  </ul>
                </>
              )}
              {!hayPlanes && <h2 id="planes" className="sr-only">Clases</h2>}
              <ClasesSemana clases={clases} />
            </div>
          </section>
        )}

        {/* 3 · Cómo llegar, horarios y WhatsApp. */}
        {hayLlegar && (
          <section aria-labelledby="llegar" className="px-5 py-14 sm:py-20" data-seccion="llegar">
            <div className="mx-auto max-w-5xl">
              <Titulo id="llegar" dibujo={<Cronometro className="w-16" />}>Cómo llegar</Titulo>
              <div className="grid gap-4 md:grid-cols-2">
                {sedes.map((s) => {
                  const mapa = s.mapa_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.direccion ?? "")}`;
                  return (
                    <div key={s.nombre + s.direccion} className="tarjeta p-6" data-sede-direccion>
                      {sedes.length > 1 && <p className="titulo text-2xl mb-2">{s.nombre}</p>}
                      <p className="text-xl">{s.direccion}</p>
                      <a href={mapa} target="_blank" rel="noopener noreferrer" className="boton mt-5" data-link-mapa><Icono nombre="ubicacion" /> Abrir en el mapa</a>
                    </div>
                  );
                })}
                {horarios.map((x) => (
                  <div key={x.sede_id} className="tarjeta" data-horarios-sede={x.sede}>
                    <div className="flex flex-wrap items-center justify-between gap-2 px-6 pt-5">
                      <p className="titulo text-2xl">{horarios.length > 1 ? x.sede : "Horarios"}</p>
                      <EstadoAhora texto={x.texto} abierto={x.abierto} />
                    </div>
                    <dl className="divide-y divide-[var(--borde)] mt-2">
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
              {whatsapp && (
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="boton boton-principal text-lg px-8 mt-8" data-dato-whatsapp>
                  <Icono nombre="mensaje" /> Escribinos por WhatsApp
                </a>
              )}
            </div>
          </section>
        )}

        {/* 4 · Reglamento y "Ya soy socio". */}
        <section aria-labelledby="socios" className="px-5 py-14 sm:py-20" data-seccion="socios">
          <div className="mx-auto max-w-5xl grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <Titulo id="socios">¿Ya entrenás acá?</Titulo>
              <p className="text-lg texto-suave max-w-[46ch] -mt-4">Entrá con tu DNI o tu teléfono para ver tu cuota, tus clases y tu QR de entrada.</p>
              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                {sesion
                  ? <a href={sesion.esSocio ? "/app" : "/panel"} className="boton boton-principal text-lg px-8"><Icono nombre="persona" /> {sesion.esSocio ? "Ir a mi perfil" : "Ir al panel"}</a>
                  : <a href="/ingresar?modo=socio" className="boton boton-principal text-lg px-8" data-ya-soy-socio-abajo><Icono nombre="llave" /> Ya soy socio, entrar</a>}
                {cargada.tiene_terminos && <a href="/terminos" className="boton text-lg px-8" data-reglamento><Icono nombre="documento" /> Reglamento</a>}
              </div>
            </div>
            <Soga className="hidden md:block w-40 texto-tenue" />
          </div>
        </section>
      </main>

      <footer className="px-5 pt-10 pb-12 border-t border-[var(--borde)]">
        <div className="mx-auto max-w-5xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><Logo marca={marca} /><span className="titulo text-xl">{marca.nombre}</span></div>
          <div className="flex flex-wrap gap-2">
            {contacto.instagram && <a href={`https://instagram.com/${contacto.instagram}`} target="_blank" rel="noopener noreferrer" className="boton"><Icono nombre="camara" /> Instagram</a>}
            {contacto.email && <a href={`mailto:${contacto.email}`} className="boton"><Icono nombre="mail" /> Mail</a>}
            <a href="/privacidad" className="boton" data-privacidad-link><Icono nombre="candado" /> Privacidad</a>
          </div>
        </div>
        <div className="mx-auto max-w-5xl mt-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm texto-tenue">Página hecha con {NOMBRE_PRODUCTO}</p>
          <span className="flex items-center gap-4">
            <Banco className="w-16 texto-tenue" />
            <a href="/ingresar" className="text-sm texto-suave underline underline-offset-4"><Icono nombre="escudo" /> Soy del equipo</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
