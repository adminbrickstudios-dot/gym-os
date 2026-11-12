import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { Vacio } from "@/components/ui/Vacio";
import { miSocio } from "@/lib/app/socio";
import { resumirHorarios, textoCierre } from "@/lib/horarios";
import { traerAgenda, traerLanding } from "@/lib/landing";
import { linkWhatsapp } from "@/lib/landing-textos";
import { intentar } from "@/lib/panel/intentar";
import { rpc } from "@/lib/panel/servidor";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "Info del gimnasio" };

/**
 * VD-63 · Info del gimnasio, dentro de la app: horarios y feriados, reglamento, contacto y WhatsApp, cómo llegar y
 * preguntas frecuentes. Sale de los MISMOS datos que la página pública (landing_publica y agenda_publica; nada se
 * tipea dos veces); lo único propio es el reglamento, que el socio puede releer aunque ya lo haya firmado.
 * Lo que el gimnasio no cargó, no aparece (ninguna sección vacía).
 */
export default async function InfoGimnasio({ searchParams }: { searchParams: Promise<{ socio?: string }> }) {
  const pedido = (await searchParams).socio;
  return intentar(async () => {
    const { yo } = await miSocio(pedido);
    if (yo.elegir) return <p className="texto-suave">Elegí primero <Link href="/app" className="underline">qué socio sos</Link>.</p>;
    const s = yo.socio!;
    const host = (await headers()).get("x-gimnasio-host");
    const [landing, agenda, info] = await Promise.all([
      host ? traerLanding(host) : null,
      host ? traerAgenda(host) : null,
      rpc<{ reglamento: { titulo: string; version: number; texto: string } | null }>("info_gimnasio_socio", { p_socio_id: s.socio_id }),
    ]);
    const publicada = landing && landing.publicada ? landing : null;
    const contacto = publicada ? publicada.contacto : landing?.contacto ?? null;
    const wa = linkWhatsapp(contacto?.whatsapp, (publicada?.contacto.mensaje_whatsapp || landing?.contacto?.mensaje_whatsapp) || "Hola!");
    const sedes = (agenda?.sedes ?? []).filter((x) => x.franjas.length);
    const filasLibres = publicada?.secciones.find((x) => x.tipo === "horarios");
    const libres = filasLibres && filasLibres.tipo === "horarios" ? filasLibres.contenido.filas ?? [] : [];
    const cierres = agenda?.cierres ?? [];
    const llegar = (publicada?.sedes ?? []).filter((x) => x.direccion);
    const preguntasSeccion = publicada?.secciones.find((x) => x.tipo === "preguntas");
    const preguntas = preguntasSeccion && preguntasSeccion.tipo === "preguntas" ? preguntasSeccion.contenido.items ?? [] : [];
    const hayContacto = !!(wa || publicada?.contacto.instagram || publicada?.contacto.email || llegar.some((x) => x.telefono));
    const hayAlgo = sedes.length > 0 || libres.length > 0 || cierres.length > 0 || !!info.reglamento || hayContacto || llegar.length > 0 || preguntas.length > 0;
    const Tit = ({ children }: { children: React.ReactNode }) => <h2 className="titulo text-2xl mb-3">{children}</h2>;

    return (
      <div className="space-y-8" data-info-gimnasio>
        <div>
          <h1 className="titular text-5xl">Info del gimnasio</h1>
          <p className="texto-suave mt-2">Horarios, reglamento y cómo comunicarte, siempre a mano.</p>
        </div>
        {!hayAlgo && <Vacio emoji="inicio" titulo="Todavía no hay información cargada">El gimnasio aún no cargó sus horarios ni su contacto. Escribile desde Mensajes y te cuentan.</Vacio>}

        {(sedes.length > 0 || libres.length > 0) && (
          <section aria-label="Horarios" data-info-horarios>
            <Tit><Icono nombre="reloj" /> Horarios</Tit>
            <div className="space-y-3">
              {sedes.length > 0 ? sedes.map((x) => (
                <div key={x.sede_id} className="tarjeta" data-horarios-sede={x.sede}>
                  {(sedes.length > 1 || x.texto) && (
                    <p className="px-5 pt-4 flex flex-wrap items-center gap-2">
                      {sedes.length > 1 && <strong><Icono nombre="ubicacion" /> {x.sede}</strong>}
                      {x.texto && <span className={`pildora ${x.abierto ? "pildora-verde" : ""}`}>{x.texto}</span>}
                    </p>
                  )}
                  <dl className="divide-y divide-[var(--borde)]">
                    {resumirHorarios(x.franjas).map((f) => (
                      <div key={f.dias} className="flex justify-between items-baseline gap-4 px-5 py-3">
                        <dt className="texto-suave">{f.dias}</dt>
                        <dd className={`text-right ${f.horas === "Cerrado" ? "texto-tenue" : "numero"}`}>{f.horas}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )) : (
                <dl className="tarjeta divide-y divide-[var(--borde)]">
                  {libres.map((f) => (
                    <div key={f.dias} className="flex justify-between items-baseline gap-4 px-5 py-3"><dt className="texto-suave">{f.dias}</dt><dd className="numero text-right">{f.horas}</dd></div>
                  ))}
                </dl>
              )}
            </div>
          </section>
        )}

        {cierres.length > 0 && (
          <section aria-label="Feriados y cierres" data-info-cierres>
            <Tit><Icono nombre="prohibido" /> Feriados y cierres</Tit>
            <ul className="space-y-2">
              {cierres.map((c) => (
                <li key={`${c.desde}-${c.sede ?? ""}`} className="mensaje mensaje-aviso" data-cierre>Cerrado {textoCierre(c)}{c.sede ? ` (${c.sede})` : ""}: {c.motivo}</li>
              ))}
            </ul>
          </section>
        )}

        {hayContacto && (
          <section aria-label="Contacto" data-info-contacto>
            <Tit><Icono nombre="mensaje" /> Contacto</Tit>
            <div className="flex flex-wrap gap-2">
              {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="boton boton-principal" data-info-whatsapp><Icono nombre="mensaje" /> WhatsApp</a>}
              {llegar.filter((x) => x.telefono).slice(0, 1).map((x) => <a key={x.nombre} href={`tel:${x.telefono}`} className="boton"><Icono nombre="telefono" /> Llamar</a>)}
              {publicada?.contacto.email && <a href={`mailto:${publicada.contacto.email}`} className="boton"><Icono nombre="mail" /> Mail</a>}
              {publicada?.contacto.instagram && <a href={`https://instagram.com/${publicada.contacto.instagram}`} target="_blank" rel="noopener noreferrer" className="boton"><Icono nombre="camara" /> Instagram</a>}
              <Link href="/app/mensajes/nuevo" className="boton"><Icono nombre="lapiz" /> Escribir desde la app</Link>
            </div>
          </section>
        )}

        {llegar.length > 0 && (
          <section aria-label="Cómo llegar" data-info-llegar>
            <Tit><Icono nombre="ubicacion" /> Cómo llegar</Tit>
            <ul className="space-y-3">
              {llegar.map((x) => (
                <li key={x.nombre} className="tarjeta p-5">
                  {llegar.length > 1 && <p className="font-semibold">{x.nombre}</p>}
                  <p className="text-lg">{x.direccion}</p>
                  {x.mapa_url && <a href={x.mapa_url} target="_blank" rel="noopener noreferrer" className="boton mt-4"><Icono nombre="ubicacion" /> Abrir el mapa</a>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {info.reglamento && (
          <section aria-label="Reglamento" data-info-reglamento>
            <Tit><Icono nombre="documento" /> Reglamento</Tit>
            <details className="tarjeta group">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 min-h-14 font-semibold">
                {info.reglamento.titulo}
                <span aria-hidden className="texto-suave transition-transform group-open:rotate-45"><Icono nombre="mas" /></span>
              </summary>
              <p className="px-5 pb-5 texto-suave whitespace-pre-line">{info.reglamento.texto}</p>
            </details>
          </section>
        )}

        {preguntas.length > 0 && (
          <section aria-label="Preguntas frecuentes" data-info-preguntas>
            <Tit><Icono nombre="persona" /> Preguntas frecuentes</Tit>
            <div className="space-y-2">
              {preguntas.map((q, i) => (
                <details key={`${i}-${q.pregunta}`} className="tarjeta group">
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 min-h-14 font-semibold">
                    {q.pregunta}
                    <span aria-hidden className="texto-suave transition-transform group-open:rotate-45"><Icono nombre="mas" /></span>
                  </summary>
                  <p className="px-5 pb-5 texto-suave">{q.respuesta}</p>
                </details>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  });
}
