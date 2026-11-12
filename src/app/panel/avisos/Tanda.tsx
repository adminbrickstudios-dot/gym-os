"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { linkWhatsappSocio } from "@/lib/whatsapp";
import { marcarAvisado } from "./acciones";
import type { Aviso } from "./Aviso";
import { Icono } from "@/components/ui/Icono";

/**
 * VEH-1: "avisar a todos" uno tras otro. Cada toque abre un WhatsApp con su
 * mensaje y lo deja "avisado ✓" (el navegador abre una ventana por toque: no
 * se pueden abrir todas juntas). Los que no tienen teléfono no entran.
 */
export function TandaAvisos({ avisos, etiqueta = "Avisar a todos", principal = false }: { avisos: Aviso[]; etiqueta?: string; principal?: boolean }) {
  const router = useRouter();
  // La cola se congela al abrir: cada "avisado" recarga la página y no tiene que correr la fila.
  const pendientes = avisos.filter((a) => !a.avisado_en && linkWhatsappSocio(a.telefono, a.mensaje));
  const [cola, setCola] = useState<Aviso[]>([]);
  const sinTelefono = avisos.filter((a) => !a.avisado_en && !linkWhatsappSocio(a.telefono, a.mensaje)).length;
  const [abierto, setAbierto] = useState(false);
  const [i, setI] = useState(0);
  const [avisados, setAvisados] = useState(0);
  const [error, setError] = useState<string | null>(null);
  if (!abierto && pendientes.length < 2) return null;
  const cerrar = () => { setAbierto(false); router.refresh(); };
  if (!abierto) {
    return (
      <button type="button" className={`boton !min-h-11 ${principal ? "boton-principal" : ""}`} data-tanda onClick={() => { setCola(pendientes); setAbierto(true); setI(0); setAvisados(0); }}>
        <Icono nombre="campana" /> {etiqueta} ({pendientes.length})
      </button>
    );
  }
  const a = cola[i];
  return (
    <div className="tarjeta p-4 sm:p-5 space-y-3 basis-full" data-tanda-abierta role="region" aria-label="Avisar a todos">
      {a ? (
        <>
          <p className="texto-tenue text-sm">{i + 1} de {cola.length}{sinTelefono ? ` · ${sinTelefono} sin teléfono` : ""}</p>
          <p className="font-semibold text-lg">{a.nombre}</p>
          <p className="text-sm texto-suave line-clamp-3">“{a.mensaje}”</p>
          <div className="flex flex-wrap gap-2">
            <a href={linkWhatsappSocio(a.telefono, a.mensaje) ?? "#"} target="_blank" rel="noopener noreferrer" className="boton boton-principal !min-h-11"
              onClick={() => {
                void marcarAvisado(a.socio_id, a.clave, a.referencia).then((r) => r.error && setError(`${a.nombre}: ${r.error}`));
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
