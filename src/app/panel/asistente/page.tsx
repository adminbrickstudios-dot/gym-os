import type { Metadata } from "next";
import Link from "next/link";
import { Encabezado } from "@/components/panel/Marco";
import type { PrimerosPasosDatos } from "@/components/panel/PrimerosPasos";
import { intentar } from "@/lib/panel/intentar";
import { contextoPanel, exigirRol, rpc } from "@/lib/panel/servidor";

export const metadata: Metadata = { title: "Asistente de configuración" };

/**
 * BASE-7 (D44) · El asistente de 9 pasos, sobre los Primeros pasos: lo que está hecho lo calcula la base (primeros_pasos),
 * así que es reanudable sin guardar nada más. Cada paso explica para qué sirve y lleva a la pantalla que lo resuelve.
 * Los pasos que la base no mide (cómo entra la gente, clases y profes) se marcan "para revisar".
 */
const PASOS: { n: number; clave: string | null; titulo: string; sirve: string; href: string; opcional?: boolean }[] = [
  { n: 1, clave: "gimnasio", titulo: "Datos del gimnasio", sirve: "Nombre, dirección y contacto: es lo que ven tus socios en la página y en la app.", href: "/panel/configuracion?pestana=gimnasio" },
  { n: 2, clave: "marca", titulo: "Logo, colores y portada", sirve: "Para que el panel, la página y la app sean tuyos. Ves una vista previa antes de guardar.", href: "/panel/configuracion?pestana=marca" },
  { n: 3, clave: "horarios", titulo: "Horarios", sirve: "Cuándo abrís. La página y la app los muestran y el ingreso los respeta.", href: "/panel/configuracion?pestana=horarios" },
  { n: 4, clave: "planes", titulo: "Planes y precios", sirve: "Lo que vendés y cuánto cuesta (y si das una clase de prueba gratis). Sin planes no se puede cobrar.", href: "/panel/planes" },
  { n: 5, clave: "cobros", titulo: "Cómo cobrás", sirve: "Efectivo, transferencia, tarjeta y MercadoPago. Cada medio que prendés aparece en la hoja Cobrar.", href: "/panel/configuracion?pestana=cobros" },
  { n: 6, clave: null, titulo: "Cómo entra la gente", sirve: "Por recepción, QR, tablet o llavero; cuántos días de tolerancia hay y qué pasa con los que deben.", href: "/panel/configuracion?pestana=entrada", opcional: true },
  { n: 7, clave: null, titulo: "Clases y profes", sirve: "Si das clases, los horarios y quién las da. Se puede saltar si no tenés.", href: "/panel/clases", opcional: true },
  { n: 8, clave: "equipo", titulo: "Equipo", sirve: "Tu recepción, encargados y profes, cada uno con su mail y su contraseña.", href: "/panel/equipo" },
  { n: 9, clave: "socios", titulo: "Cargar socios", sirve: "A mano o con un Excel: antes de importar ves cuáles filas tienen problemas, con el motivo.", href: "/panel/socios/importar" },
];

export default async function Asistente() {
  return intentar(async () => {
    const panel = await contextoPanel();
    exigirRol(panel, ["dueno"]);
    const datos = await rpc<PrimerosPasosDatos>("primeros_pasos", { p_gimnasio_id: panel.gimnasio.id });
    const hecho = (clave: string | null) => (clave ? datos.pasos.find((p) => p.clave === clave)?.hecho ?? false : false);
    const medibles = PASOS.filter((p) => p.clave);
    const listos = medibles.filter((p) => hecho(p.clave)).length;
    const proximo = PASOS.find((p) => p.clave && !hecho(p.clave)) ?? null;
    const terminado = !proximo;
    return (
      <>
        <Encabezado emoji="🚀" titulo="Asistente de configuración" bajada="Nueve pasos cortos para dejar tu gimnasio listo. Podés salir y volver: sigue donde quedaste." />
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
                    <p className="font-semibold text-lg">{p.n}. {p.titulo}{p.opcional ? <span className="texto-tenue text-sm font-normal"> · para revisar{p.n === 7 ? " (se puede saltar)" : ""}</span> : null}</p>
                    <p className="texto-suave">{p.sirve}</p>
                  </div>
                  <Link href={p.href} className="boton !min-h-11">{ok ? "Revisar" : "Hacer este paso"}</Link>
                </li>
              );
            })}
          </ol>
          {terminado && (
            <section className="tarjeta p-6 space-y-3" data-asistente-listo aria-label="Tu gimnasio está listo">
              <h2 className="titulo text-3xl">🎉 Tu gimnasio está listo</h2>
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
