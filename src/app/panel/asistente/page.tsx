import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";
import { urlMarca } from "@/lib/url-marca";
import { Icono } from "@/components/ui/Icono";

export const metadata: Metadata = { title: "Asistente de configuración" };

type PasoAsistente = { n: number; clave: string; hecho: boolean; no_aplica: boolean };
type ConfigMarca = { logo_path: string | null; color_acento: string; color_fondo: string };
type PaginaMarca = { portada: { foto_path: string | null; titulo: string } };

/**
 * BASE-7 (D44) · El asistente de 9 pasos, sobre los Primeros pasos: lo que está hecho lo calcula la base (primeros_pasos),
 * así que es reanudable sin guardar nada más. Cada paso explica para qué sirve y lleva a la pantalla que lo resuelve.
 * Los 9 pasos se miden como hechos (pasos_asistente); el 7 no aplica si el gimnasio no da clases.
 */
const PASOS: { n: number; clave: string; titulo: string; sirve: string; href: string }[] = [
  { n: 1, clave: "gimnasio", titulo: "Datos del gimnasio", sirve: "Nombre, dirección y contacto: es lo que ven tus socios en la página y en la app.", href: "/panel/configuracion?pestana=gimnasio" },
  { n: 2, clave: "marca", titulo: "Logo, colores y portada", sirve: "Para que el panel, la página y la app sean tuyos. Ves una vista previa antes de guardar.", href: "/panel/configuracion?pestana=marca" },
  { n: 3, clave: "horarios", titulo: "Horarios", sirve: "Cuándo abrís. La página y la app los muestran y el ingreso los respeta.", href: "/panel/configuracion?pestana=horarios" },
  { n: 4, clave: "planes", titulo: "Planes y precios", sirve: "Lo que vendés y cuánto cuesta (y si das una clase de prueba gratis). Sin planes no se puede cobrar.", href: "/panel/planes" },
  { n: 5, clave: "cobros", titulo: "Cómo cobrás", sirve: "Efectivo, transferencia, tarjeta y MercadoPago (con “Probar conexión” para ver que funciona). Cada medio que prendés aparece en la hoja Cobrar.", href: "/panel/configuracion?pestana=cobros" },
  { n: 6, clave: "entrada_modos", titulo: "Cómo entra la gente", sirve: "Por recepción, QR, tablet o llavero; cuántos días de tolerancia hay y qué pasa con los que deben. Se tacha cuando cambiás alguna de esas reglas o autorizás una tablet.", href: "/panel/configuracion?pestana=reglas" },
  { n: 7, clave: "clases_profes", titulo: "Clases y profes", sirve: "Si das clases, los horarios y quién las da. Si no das clases, este paso no aplica y se salta solo.", href: "/panel/clases" },
  { n: 8, clave: "equipo", titulo: "Equipo", sirve: "Tu recepción, encargados y profes, cada uno con su mail y su contraseña.", href: "/panel/equipo" },
  { n: 9, clave: "socios", titulo: "Cargar socios", sirve: "A mano o con un Excel: antes de importar ves cuáles filas tienen problemas, con el motivo.", href: "/panel/socios/importar" },
];

export default async function Asistente() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno"]);
    const [medidos, config, pagina] = await Promise.all([
      rpc<PasoAsistente[]>("pasos_asistente", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<ConfigMarca>("configuracion_panel", { p_gimnasio_id: panel.gimnasio.id }),
      rpc<PaginaMarca>("pagina_panel", { p_gimnasio_id: panel.gimnasio.id }),
    ]);
    const hecho = (clave: string) => medidos.find((p) => p.clave === clave)?.hecho ?? false;
    const noAplica = (clave: string) => medidos.find((p) => p.clave === clave)?.no_aplica ?? false;
    const medibles = PASOS;
    const listos = medibles.filter((p) => hecho(p.clave)).length;
    const proximo = PASOS.find((p) => !hecho(p.clave)) ?? null;
    const logo = urlMarca(config.logo_path);
    const portada = urlMarca(pagina.portada.foto_path);
    const terminado = !proximo;
    return (
      <>
        <Encabezado icono="estrella" titulo="Asistente de configuración" bajada="Nueve pasos cortos para dejar tu gimnasio listo. Podés salir y volver: sigue donde quedaste." />
        <div className="space-y-6" data-asistente data-asistente-listos={listos}>
          <div className="space-y-2">
            <p className="texto-suave"><span className="numero text-xl">{listos}</span> de {medibles.length} pasos medidos listos</p>
            <div className="h-2 rounded-full bg-[var(--tarjeta-alta)] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={medibles.length} aria-valuenow={listos} aria-label="Avance del asistente">
              <div className="h-full bg-[var(--acento)]" style={{ width: `${Math.round((listos / medibles.length) * 100)}%` }} />
            </div>
          </div>
          {proximo && (
            <Link href={proximo.href} className="boton boton-principal w-full sm:w-auto !min-h-14 text-lg" data-asistente-seguir={proximo.clave}>Seguir donde quedé: {proximo.titulo} →</Link>
          )}
          <ol className="space-y-3">
            {PASOS.map((p) => {
              const ok = hecho(p.clave);
              return (
                <li key={p.n} data-asistente-paso={p.n} data-hecho={ok ? "si" : "no"} className="tarjeta p-4 flex flex-wrap items-start gap-3">
                  <span className={`numero text-2xl w-9 text-center ${ok ? "texto-tenue" : ""}`} aria-hidden>{ok ? "✓" : p.n}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-lg">{p.n}. {p.titulo}{noAplica(p.clave) ? <span className="texto-tenue text-sm font-normal"> · no aplica: no das clases</span> : null}</p>
                    <p className="texto-suave">{p.sirve}</p>
                    {p.n === 2 && (
                      <div className="mt-3 flex flex-wrap items-center gap-3" data-vista-marca>
                        <span className="grid place-items-center w-20 h-20 rounded-[var(--radio)] border border-[var(--borde)] overflow-hidden" style={{ background: config.color_fondo }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {logo ? <img src={logo} alt="Tu logo" className="max-w-full max-h-full object-contain" data-vista-logo /> : <span className="texto-tenue text-xs text-center px-1">Sin logo</span>}
                        </span>
                        <span className="inline-block w-20 h-10 rounded-[var(--radio)] border border-[var(--borde)]" style={{ background: config.color_acento }} role="img" aria-label="Tu color" data-vista-acento />
                        <span className="grid place-items-center w-40 h-20 rounded-[var(--radio)] border border-[var(--borde)] overflow-hidden bg-[var(--tarjeta-alta)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {portada ? <img src={portada} alt="Tu portada" className="w-full h-full object-cover" data-vista-portada /> : <span className="texto-tenue text-xs text-center px-1">Sin portada (se sube en Tu página)</span>}
                        </span>
                      </div>
                    )}
                  </div>
                  <Link href={p.href} className="boton !min-h-11">{ok ? "Revisar" : "Hacer este paso"}</Link>
                </li>
              );
            })}
          </ol>
          {terminado && (
            <section className="tarjeta p-6 space-y-3" data-asistente-listo aria-label="Tu gimnasio está listo">
              <h2 className="titulo text-3xl"><Icono nombre="estrella" /> Tu gimnasio está listo</h2>
              <p className="texto-suave">Estos son los links de cada persona. Cada uno entra con su mail y su contraseña, y cae en su panel:</p>
              <ul className="space-y-1">
                {[["Dueño", "/dueno"], ["Recepción", "/recepcion"], ["Profes", "/profe"], ["Socios", "/socio"]].map(([q, r]) => (
                  <li key={r}><strong>{q}:</strong> <a className="underline" href={r} data-link-rol={r}>{r}</a></li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </>
    );
  });
}
