"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { linkWhatsappSocio } from "@/lib/whatsapp";
import { anotarContacto } from "./acciones";
import { Icono } from "@/components/ui/Icono";

export type ParaAvisar = { socio_id: string; nombre: string; telefono: string | null; mensaje: string | null; lista: string; contactado: boolean };

/** Cuántos se avisan por tanda: más que eso deja de ser un aviso a mano (y WhatsApp lo toma por spam). */
export const TOPE_TANDA = 30;

/**
 * Q2 · "Avisar a todos" en Retención: uno tras otro, con tope. Cada toque abre WhatsApp con su mensaje y deja
 * el contacto anotado (quién y cuándo: nadie le escribe dos veces). Los que ya tienen contacto anotado o no tienen
 * teléfono no entran. El navegador abre una ventana por toque: no se pueden abrir todas juntas.
 */
export function TandaContactos({ items, etiqueta = "Avisar a todos" }: { items: ParaAvisar[]; etiqueta?: string }) {
  const router = useRouter();
  const pendientes = items.filter((a) => !a.contactado && linkWhatsappSocio(a.telefono, a.mensaje));
  const sinTelefono = items.filter((a) => !a.contactado && !linkWhatsappSocio(a.telefono, a.mensaje)).length;
  const [cola, setCola] = useState<ParaAvisar[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [i, setI] = useState(0);
  const [avisados, setAvisados] = useState(0);
  const [error, setError] = useState<string | null>(null);
  if (!abierto && pendientes.length < 2) return null;
  const cerrar = () => { setAbierto(false); router.refresh(); };
  if (!abierto) {
    const van = Math.min(TOPE_TANDA, pendientes.length);
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3" data-tanda-retencion>
        <button type="button" className="boton boton-principal !min-h-11" data-tanda onClick={() => { setCola(pendientes.slice(0, TOPE_TANDA)); setAbierto(true); setI(0); setAvisados(0); setError(null); }}>
          <Icono nombre="campana" /> {etiqueta} ({van})
        </button>
        {pendientes.length > TOPE_TANDA && <p className="texto-tenue text-sm" data-tanda-tope>Se avisa de a {TOPE_TANDA}; quedan {pendientes.length - TOPE_TANDA} para la próxima tanda.</p>}
      </div>
    );
  }
  const a = cola[i];
  return (
    <div className="tarjeta p-4 sm:p-5 space-y-3 mb-4" data-tanda-abierta role="region" aria-label="Avisar a todos">
      {a ? (
        <>
          <p className="texto-tenue text-sm">{i + 1} de {cola.length}{sinTelefono ? ` · ${sinTelefono} sin teléfono` : ""}</p>
          <p className="font-semibold text-lg">{a.nombre}</p>
          <p className="text-sm texto-suave line-clamp-3">“{a.mensaje}”</p>
          <div className="flex flex-wrap gap-2">
            <a href={linkWhatsappSocio(a.telefono, a.mensaje) ?? "#"} target="_blank" rel="noopener noreferrer" className="boton boton-principal !min-h-11"
              onClick={() => {
                void anotarContacto(a.socio_id, a.lista, "enviado").then((r) => r.error && setError(`${a.nombre}: ${r.error}`));
                setAvisados((n) => n + 1); setI((n) => n + 1);
              }}>
              <Icono nombre="mensaje" /> Abrir WhatsApp {i + 1 < cola.length ? "y seguir" : ""}
            </a>
            <button type="button" className="boton !min-h-11" onClick={() => setI((n) => n + 1)}>Saltear</button>
            <button type="button" className="boton !min-h-11 texto-suave" onClick={cerrar}>Terminar</button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="font-semibold flex-1" data-tanda-fin><Icono nombre="ok" /> Listo: {avisados === 1 ? "avisaste a 1" : `avisaste a ${avisados}`}{cola.length - avisados ? `, salteaste ${cola.length - avisados}` : ""}.</p>
          <button type="button" className="boton !min-h-11" onClick={cerrar}>Cerrar</button>
        </div>
      )}
      {error && <p role="alert" className="pildora pildora-rojo"><Icono nombre="alerta" /> {error}</p>}
    </div>
  );
}
