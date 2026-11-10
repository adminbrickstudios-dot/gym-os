"use client";
// Lo que comparten Vender (el carrito de siempre) y Cobrar (la hoja flotante de VD-5).
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { comprobante } from "./acciones";
import { anularVenta, pedirAnulacion } from "../ventas-acciones";
import { linkWhatsappSocio } from "@/lib/whatsapp";
import type { Medio } from "./tipos";
import { Icono } from "@/components/ui/Icono";

export const MEDIOS: { medio: Medio; texto: string }[] = [
  { medio: "efectivo", texto: "Efectivo" },
  { medio: "transferencia", texto: "Transferencia" },
  { medio: "debito", texto: "Débito" },
  { medio: "credito", texto: "Crédito" },
];

/** Se cobró mal: el dueño o el encargado la anulan acá; la recepción pide que la anulen (VEN-6). */
export function DeshacerVenta({ ventaId, puedeAnular, socioId }: { ventaId: string; puedeAnular: boolean; socioId: string | null }) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [hecho, setHecho] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  if (hecho) return <p role="status" className="mt-5 texto-suave" data-deshacer-hecho>{hecho}</p>;
  if (!abierto) return <button type="button" className="boton-texto mt-5" onClick={() => setAbierto(true)}><Icono nombre="deshacer" /> {puedeAnular ? "Anular esta venta" : "Me equivoqué: pedir que la anulen"}</button>;
  return (
    <form className="mt-5 flex flex-col sm:flex-row gap-2" onSubmit={(e) => {
      e.preventDefault();
      empezar(async () => {
        const r = puedeAnular ? await anularVenta(ventaId, motivo, socioId) : await pedirAnulacion(ventaId, motivo);
        if (r.error) setError(r.error); else setHecho(puedeAnular ? "Venta anulada: se revirtió lo que habilitó." : "Pedido enviado: el dueño o el encargado lo ven en Inicio.");
      });
    }}>
      <input autoFocus className="campo" placeholder="Por qué (obligatorio)" aria-label="Motivo de la anulación" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <button type="submit" className="boton boton-peligro" disabled={!motivo.trim() || ocupado}>{puedeAnular ? "Anular" : "Pedir"}</button>
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
    </form>
  );
}

/** VEN-1: el comprobante por WhatsApp, ya escrito (Configuración → Mensajes). Se arma apenas se cobra, así el toque abre WhatsApp directo. */
export function MandarComprobante({ ventaId, className = "mt-5" }: { ventaId: string; className?: string }) {
  const [c, setC] = useState<{ link: string | null; mensaje: string; error?: string } | null>(null);
  useEffect(() => {
    let vivo = true;
    comprobante(ventaId).then((r) => { if (vivo) setC({ link: r.error ? null : linkWhatsappSocio(r.telefono, r.mensaje), mensaje: r.mensaje ?? "", error: r.error }); });
    return () => { vivo = false; };
  }, [ventaId]);
  return (
    <>
      <VerRecibo ventaId={ventaId} className={className} />
      {c && (c.error
        ? <p role="alert" className={`pildora pildora-rojo ${className}`}><Icono nombre="alerta" /> {c.error}</p>
        : c.link
          ? <a href={c.link} target="_blank" rel="noopener noreferrer" className={`boton ${className}`} data-comprobante><Icono nombre="recibo" /> Mandar comprobante por WhatsApp</a>
          : <p className={`${className} texto-suave`} data-comprobante>Sin celular cargado para mandarle el comprobante.</p>)}
    </>
  );
}

/** VD-56: el recibo de lo recién cobrado, en una pestaña aparte para no perder la pantalla de cobro. */
export function VerRecibo({ ventaId, className = "mt-5" }: { ventaId: string; className?: string }) {
  return <Link href={`/panel/recibo/${ventaId}`} target="_blank" rel="noopener" className={`boton ${className}`} data-ver-recibo><Icono nombre="documento" /> Ver recibo (imprimir o PDF)</Link>;
}
