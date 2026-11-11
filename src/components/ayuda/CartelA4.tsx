// C4 · Una hoja A4 para pegar en la pared, con la marca del gimnasio: franja con su color y su logo, y el nombre. Todo el tamaño va en
// unidades del contenedor (cqw), así la misma hoja se ve completa en el celular y sale a escala en el papel. En el papel se imprime
// solo la hoja (la regla de impresión de globals.css deja visible nada más que "recibo-hoja"). Fondo blanco: se ve bien aunque el
// gimnasio use el tema oscuro, y gasta poca tinta.
import type { CSSProperties, ReactNode } from "react";
import { textoSobre } from "@/lib/marca";
import { urlMarca } from "@/lib/url-marca";

const ESTILO = `
@page { size: A4 portrait; margin: 0; }
.cartel-hoja { container-type: inline-size; aspect-ratio: 210 / 297; width: 100%; max-width: 30rem; background: #fff !important; color: #15171a !important;
  display: flex; flex-direction: column; overflow: hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact; border: 1px solid #e2e4e8; }
.cartel-franja { display: flex; align-items: center; gap: 4cqw; padding: 5cqw 7cqw; }
.cartel-logo { height: 13cqw; width: 13cqw; object-fit: contain; flex: none; background: #fff; border-radius: 2cqw; padding: 1cqw; }
.cartel-nombre { font-size: 7cqw; line-height: 1.05; font-weight: 700; overflow-wrap: anywhere; }
.cartel-cuerpo { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 5cqw; padding: 6cqw 8cqw; }
.cartel-titulo { font-size: 15cqw; line-height: 0.98; font-weight: 700; letter-spacing: 0; }
.cartel-pasos { display: flex; flex-direction: column; gap: 3.5cqw; list-style: none; margin: 0; padding: 0; }
.cartel-pasos li { display: flex; align-items: center; gap: 4cqw; font-size: 5.6cqw; line-height: 1.15; font-weight: 500; }
.cartel-num { flex: none; width: 9cqw; height: 9cqw; border-radius: 50%; display: grid; place-items: center; font-size: 5.6cqw; font-weight: 700; }
.cartel-pie { font-size: 4.4cqw; line-height: 1.25; padding: 4cqw 8cqw 6cqw; border-top: 0.6cqw solid; }
.cartel-qr { width: 62cqw; aspect-ratio: 1; background: #fff; padding: 2cqw; border: 0.8cqw solid #15171a; align-self: center; }
.cartel-qr svg { display: block; width: 100%; height: 100%; }
.cartel-url { font-size: 3.6cqw; text-align: center; overflow-wrap: anywhere; color: #5b616b; }
@media print {
  html, body { height: 295mm !important; max-height: 295mm !important; overflow: hidden !important; }
  .cartel-hoja { max-width: none; width: 210mm; height: 295mm; margin: 0 !important; border: 0 !important; break-inside: avoid; break-after: avoid; }
}`;

export function CartelA4({ nombre, logoPath, acento, children, pie }: {
  nombre: string; logoPath?: string | null; acento: string; children: ReactNode; pie?: ReactNode;
}) {
  const logo = urlMarca(logoPath);
  const sobre = textoSobre(acento);
  const color = { ["--cartel-acento" as string]: acento, ["--cartel-sobre" as string]: sobre } as CSSProperties;
  return (
    <>
      <style>{ESTILO}</style>
      <article className="recibo-hoja cartel-hoja" style={color} data-cartel aria-label={`Cartel de ${nombre}`}>
        <header className="cartel-franja" style={{ background: acento, color: sobre }}>
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="cartel-logo" />
          )}
          <p className="cartel-nombre titular">{nombre}</p>
        </header>
        <div className="cartel-cuerpo">{children}</div>
        {pie && <footer className="cartel-pie" style={{ borderColor: acento }}>{pie}</footer>}
      </article>
    </>
  );
}

/** Los pasos numerados de un cartel: el círculo lleva el color del gimnasio. */
export function PasosCartel({ pasos }: { pasos: string[] }) {
  return (
    <ol className="cartel-pasos">
      {pasos.map((t, i) => (
        <li key={i}>
          <span className="cartel-num" style={{ background: "var(--cartel-acento)", color: "var(--cartel-sobre)" }} aria-hidden>{i + 1}</span>
          <span>{t}</span>
        </li>
      ))}
    </ol>
  );
}
