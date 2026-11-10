"use client";
// VD-56 · El recibo de un pago: una hoja imprimible con la marca del gimnasio, y debajo (sin imprimirse) imprimir / guardar como PDF
// y mandar por WhatsApp. Lo usan el panel (/panel/recibo/[venta]) y la app del socio (/app/recibo/[venta]).
import { useState } from "react";
import { formatearPesos } from "@/lib/formato";
import { linkWhatsappRecibo, medioTexto, textoRecibo, type ReciboDatos } from "@/lib/recibo";
import { urlMarca } from "@/lib/url-marca";
import { Icono } from "@/components/ui/Icono";

export function Recibo({ r, volver }: { r: ReciboDatos; volver?: React.ReactNode }) {
  const logo = urlMarca(r.gimnasio.logo_path);
  const [avisoCopia, setAvisoCopia] = useState<string | null>(null);
  const compartir = async () => {
    const texto = textoRecibo(r);
    try {
      if (typeof navigator.share === "function") { await navigator.share({ title: `Recibo N° ${r.numero_texto}`, text: texto }); return; }
      await navigator.clipboard.writeText(texto);
      setAvisoCopia("Copiado: pegalo donde quieras.");
    } catch { setAvisoCopia("No se pudo compartir desde este navegador: usá WhatsApp o imprimí."); }
  };
  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div data-no-imprimir>{volver}</div>
      <article className="recibo-hoja tarjeta p-6 sm:p-8 space-y-5" data-recibo={r.numero} data-estado={r.anulado ? "anulado" : "vigente"} aria-label={`Recibo ${r.numero_texto}`}>
        <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logo && <img src={logo} alt="" className="h-14 w-14 object-contain rounded" />}
          <div className="min-w-0 flex-1">
            <p className="titulo text-2xl" data-gimnasio>{r.gimnasio.nombre}</p>
            <p className="texto-suave text-sm">{r.sede.nombre}{r.sede.direccion ? ` · ${r.sede.direccion}` : ""}{r.sede.telefono ? ` · ${r.sede.telefono}` : ""}</p>
          </div>
          <div className="text-right">
            <p className="text-sm texto-suave">Recibo N°</p>
            <p className="numero text-xl" data-numero>{r.numero_texto}</p>
          </div>
        </div>
        {r.anulado && (
          <p className="rounded-[var(--radio)] border-2 border-[var(--rojo)] text-[var(--rojo)] font-bold text-center py-2 tracking-wide" data-anulado>
            RECIBO ANULADO{r.anulacion ? ` · ${r.anulacion.fecha}` : ""}{r.anulacion?.motivo ? ` · ${r.anulacion.motivo}` : ""}
          </p>)}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="texto-suave">Fecha</dt><dd data-fecha>{r.fecha}</dd>
          {r.socio && <><dt className="texto-suave">Socio</dt><dd>{r.socio.nombre}{r.socio.dni ? ` · DNI ${r.socio.dni}` : ""}</dd></>}
          {r.cobro && <><dt className="texto-suave">Cobró</dt><dd>{r.cobro}</dd></>}
        </dl>
        <table className="w-full text-sm">
          <thead><tr className="texto-suave text-left"><th className="font-normal py-1">Detalle</th><th className="font-normal text-right">Cant.</th><th className="font-normal text-right">Importe</th></tr></thead>
          <tbody>
            {r.items.map((i, k) => (
              <tr key={k} className="border-t border-[var(--borde)]" data-item>
                <td className="py-1.5">{i.descripcion}{Number(i.descuento) > 0 && <span className="texto-suave block text-xs">Descuento {formatearPesos(i.descuento)}</span>}</td>
                <td className="text-right">{i.cantidad}</td>
                <td className="text-right numero">{formatearPesos(i.subtotal)}</td>
              </tr>))}
          </tbody>
          <tfoot><tr className="border-t-2 border-[var(--borde)]"><td className="py-2 font-bold" colSpan={2}>Total</td><td className="text-right numero text-lg" data-total>{formatearPesos(r.total)}</td></tr></tfoot>
        </table>
        {r.pagos.length > 0 && (
          <ul className="text-sm space-y-0.5" data-pagos>
            {r.pagos.map((p, k) => <li key={k}>Pagado con {medioTexto(p.medio)}: {formatearPesos(p.monto)}</li>)}
          </ul>)}
        <p className="texto-tenue text-xs">Comprobante de pago emitido por {r.gimnasio.nombre}. Documento no válido como factura.</p>
      </article>
      <div className="flex flex-wrap gap-3" data-no-imprimir>
        <button type="button" className="boton boton-principal" onClick={() => window.print()} data-imprimir>Imprimir / Guardar como PDF</button>
        <a className="boton" href={linkWhatsappRecibo(r)} target="_blank" rel="noopener noreferrer" data-whatsapp><Icono nombre="mensaje" /> Mandar por WhatsApp</a>
        <button type="button" className="boton" onClick={compartir} data-compartir><Icono nombre="derecha" /> Compartir</button>
      </div>
      {avisoCopia && <p role="status" className="texto-suave text-sm" data-no-imprimir>{avisoCopia}</p>}
    </div>
  );
}
