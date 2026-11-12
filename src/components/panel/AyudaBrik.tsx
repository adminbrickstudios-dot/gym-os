"use client";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { pedirAyudaBrik } from "@/app/panel/ayuda-acciones";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Icono } from "@/components/ui/Icono";
import { linkAyudaWhatsapp } from "@/lib/ayuda-brik";

export const CLAVE_ULTIMO_ERROR = "gymos:ultimo-error";
const guardarError = (m: string) => { try { sessionStorage.setItem(CLAVE_ULTIMO_ERROR, m.slice(0, 400)); } catch { /* sin almacenamiento: el mensaje viaja igual */ } };

/**
 * VD-40: "¿Necesitás ayuda?" para el dueño y el encargado. Manda un mensaje a BRIK con el contexto
 * (gimnasio y quién salen de la sesión; acá se suma la pantalla y el último error que vio).
 * H6: además, un link de WhatsApp a BRIK con la pantalla, quién escribe (nombre y rol) y el último error, sin datos de socios.
 * La recepción solo tiene el WhatsApp (el pedido guardado de arriba es del dueño y el encargado: no se cambió quién puede qué).
 * El número lo carga el super admin; si no hay, no se muestra el WhatsApp.
 */
export function AyudaBrik({ whatsapp = null, gimnasio = "", nombre = "", rol = "", conFormulario = true }: { whatsapp?: string | null; gimnasio?: string; nombre?: string; rol?: string; conFormulario?: boolean }) {
  const pantalla = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);
  const ultimo = useRef<string | null>(null);
  const [ultimoVisto, setUltimoVisto] = useState<string | null>(null);
  useEffect(() => {
    try { setUltimoVisto(sessionStorage.getItem(CLAVE_ULTIMO_ERROR)); } catch { /* sin almacenamiento */ }
    const alError = (e: ErrorEvent) => { ultimo.current = e.message; setUltimoVisto(e.message); guardarError(e.message); };
    const alRechazo = (e: PromiseRejectionEvent) => { const m = e.reason instanceof Error ? e.reason.message : String(e.reason); ultimo.current = m; setUltimoVisto(m); guardarError(m); };
    window.addEventListener("error", alError);
    window.addEventListener("unhandledrejection", alRechazo);
    return () => { window.removeEventListener("error", alError); window.removeEventListener("unhandledrejection", alRechazo); };
  }, []);
  const enviar = async () => {
    let previo: string | null = ultimo.current;
    if (!previo) { try { previo = sessionStorage.getItem(CLAVE_ULTIMO_ERROR); } catch { previo = null; } }
    const r = await pedirAyudaBrik(mensaje, pantalla, previo);
    if (r.error) { setError(r.error); return; }
    setError(""); setEnviado(true); setMensaje(""); setAbierto(false);
  };
  const linkWa = linkAyudaWhatsapp(whatsapp, { gimnasio, nombre, rol, pantalla, ultimoError: ultimoVisto });
  const botonWa = linkWa && (
    <a href={linkWa} target="_blank" rel="noopener noreferrer" className="boton texto-suave" data-ayuda-whatsapp>
      <Icono nombre="mensaje" /> {conFormulario ? "Avisar a BRIK por WhatsApp" : "¿Necesitás ayuda? Escribile a BRIK"}
    </a>
  );
  if (!conFormulario) return botonWa ? <section className="mt-12 pt-6 border-t border-[var(--borde,#0001)]" data-ayuda-brik>{botonWa}</section> : null;
  return (
    <section className="mt-12 pt-6 border-t border-[var(--borde,#0001)] space-y-3" data-ayuda-brik>
      {enviado && <p role="status" className="mensaje mensaje-exito" data-ayuda-enviada><Icono nombre="ok" /> Le avisamos a BRIK. Te escriben a la brevedad.</p>}
      {!abierto
        ? <div className="flex flex-wrap gap-2"><button type="button" className="boton texto-suave" onClick={() => { setAbierto(true); setEnviado(false); }}><Icono nombre="alerta-circulo" /> ¿Necesitás ayuda?</button>{botonWa}</div>
        : (
          <div className="tarjeta p-4 space-y-3 max-w-xl">
            <label className="space-y-1 block"><span className="etiqueta">Contale a BRIK qué necesitás</span>
              <textarea className="campo" rows={3} maxLength={1000} value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="No me deja cargar el plan nuevo…" /></label>
            <p className="texto-tenue text-sm">Va con tu gimnasio, tu nombre y la pantalla donde estás{pantalla ? ` (${pantalla})` : ""}, así no tenés que explicarlo.</p>
            {error && <p role="alert" className="pildora pildora-rojo !rounded-[var(--radio)] !px-4 !py-3"><Icono nombre="alerta" /> {error}</p>}
            <div className="flex flex-wrap gap-2">
              <BotonAccion className="boton boton-principal" ocupadoTexto="Enviando…" disabled={mensaje.trim().length < 5} onClick={enviar}>Enviar a BRIK</BotonAccion>
              <button type="button" className="boton" onClick={() => setAbierto(false)}>Cancelar</button>
            </div>
          </div>
        )}
    </section>
  );
}
