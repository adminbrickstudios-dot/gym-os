// C3 · Una guía de uso: hasta 10 pasos, cada uno con su captura (si existe) y el botón que lleva a hacerlo. Se lee en el celular
// y se imprime en A4 (la regla de impresión de globals.css deja solo la clase "recibo-hoja"; los estilos de la hoja son locales).
import Link from "next/link";
import { BotonImprimir } from "./BotonImprimir";
import { CapturaGuia } from "./CapturaGuia";
import { type Guia, type PasoGuia, VERSION_GUIAS } from "@/lib/guias";
import { urlMarca } from "@/lib/url-marca";

const ESTILO_HOJA = `
@page { size: A4; margin: 14mm; }
.guia-paso { break-inside: avoid; }
@media print {
  .guia-hoja { font-size: 11pt; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .guia-hoja .guia-captura { max-height: 62mm; width: auto; max-width: 100%; }
  .guia-hoja .guia-num { background: var(--acento) !important; color: var(--sobre-acento) !important; }
}`;

export function GuiaHoja({ guia, pasos, conLinks, gimnasio, logoPath }: {
  guia: Guia; pasos: PasoGuia[]; conLinks: boolean; gimnasio: string; logoPath?: string | null;
}) {
  const logo = urlMarca(logoPath);
  const celu = guia.ambito === "app";
  return (
    <div className="space-y-5" data-guia={guia.rol}>
      <style>{ESTILO_HOJA}</style>
      <div className="flex flex-wrap gap-3 items-center" data-no-imprimir>
        <BotonImprimir />
        <p className="texto-suave text-sm">Se guarda como PDF desde la ventana de impresión. Sale en hojas A4.</p>
      </div>
      <article className="recibo-hoja guia-hoja tarjeta p-5 sm:p-8 space-y-6 max-w-3xl" aria-label={guia.titulo}>
        <header className="flex items-center gap-4 pb-4 border-b-2 border-[var(--acento)]">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-12 w-12 object-contain flex-none" />
          )}
          <div className="min-w-0">
            <p className="titulo text-lg texto-suave break-words">{gimnasio}</p>
            <h2 className="titular text-3xl sm:text-4xl">{guia.titulo}</h2>
            <p className="texto-suave">{guia.paraQuien}. {guia.bajada}</p>
          </div>
        </header>
        <ol className="space-y-6">
          {pasos.map((p, i) => (
            <li key={p.id} className="guia-paso flex gap-4" data-paso={p.id}>
              <span className="guia-num flex-none w-10 h-10 rounded-full grid place-items-center titulo text-xl bg-[var(--acento)] text-[var(--sobre-acento)]" aria-hidden>{i + 1}</span>
              <div className="min-w-0 flex-1">
                <h3 className="titulo text-2xl">{p.titulo}</h3>
                <p className="mt-1 text-[15px] leading-relaxed">{p.texto}</p>
                {conLinks && p.destino && (
                  <Link href={p.destino.ruta} className="boton mt-3 inline-flex" data-no-imprimir>{p.destino.boton}</Link>
                )}
                {p.captura && <CapturaGuia archivo={p.captura} celu={celu} alt={`Captura de la pantalla: ${p.titulo}`} />}
              </div>
            </li>
          ))}
        </ol>
        <footer className="text-sm texto-suave pt-3 border-t border-[var(--borde)]">{gimnasio} · {guia.titulo} · versión {VERSION_GUIAS}</footer>
      </article>
    </div>
  );
}
