"use client";
// VD-46U · Las devoluciones ya registradas de un socio dado de baja, y anular una registrada por error (con motivo).
// Anular no borra: queda el hecho (quién, cuándo, por qué) y los períodos vuelven a estar para devolver. Solo dueño y encargado.
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { formatearPesos } from "@/lib/formato";
import { anularDevolucion, type DevolucionHecha } from "../moderacion-acciones";

const MEDIOS: Record<string, string> = { efectivo: "En efectivo", transferencia: "Por transferencia", mercadopago: "Por MercadoPago", otro: "Otro medio", ninguno: "No se devuelve" };

export function DevolucionesHechas({ socioId, devoluciones, zona }: { socioId: string; devoluciones: DevolucionHecha[]; zona: string }) {
  const [anulando, setAnulando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [reintegro, setReintegro] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const f = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", year: "2-digit" }).format(new Date(m));
  const cerrar = () => { setAnulando(null); setMotivo(""); setReintegro(false); setError(null); };
  if (devoluciones.length === 0) return null;
  return (
    <ul className="space-y-2" data-devoluciones-hechas>
      {devoluciones.map((d) => (
        <li key={d.id} className="tarjeta p-4 space-y-2" data-devolucion-hecha={d.anulada ? "anulada" : "vigente"}>
          <p className={d.anulada ? "texto-tenue line-through" : "font-semibold"}>↩️ {MEDIOS[d.medio] ?? d.medio}: {formatearPesos(Number(d.monto))} · {f(d.en)}{d.por ? ` · ${d.por}` : ""}</p>
          <p className="texto-suave text-sm">{d.motivo}</p>
          {d.anulada && <p className="text-sm" data-devolucion-anulada>🚫 Anulada el {d.anulada_en ? f(d.anulada_en) : ""}{d.anulada_por ? ` por ${d.anulada_por}` : ""}: {d.anulada_motivo}{d.reintegro_caja ? " · la plata volvió a la caja" : ""}</p>}
          {!d.anulada && anulando !== d.id && <button type="button" className="boton boton-chico" data-devolucion-anular-abrir onClick={() => { cerrar(); setAnulando(d.id); }}>Anular (la registré por error)</button>}
          {anulando === d.id && (
            <div className="space-y-3">
              <label className="block"><span className="font-semibold">Por qué se anula (queda anotado con tu nombre)</span>
                <input className="campo mt-1" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: me equivoqué de monto" aria-label="Motivo de la anulación" /></label>
              {d.medio === "efectivo" && (
                <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reintegro} onChange={(e) => setReintegro(e.target.checked)} className="mt-1" />
                  <span>La plata volvió a la caja: anotar un ingreso de {formatearPesos(Number(d.monto))} en mi caja abierta.</span></label>
              )}
              {error && <p role="alert" className="pildora pildora-rojo whitespace-normal">⚠️ {error}</p>}
              <div className="flex flex-wrap gap-2">
                <BotonAccion className="boton boton-principal" disabled={motivo.trim().length < 3}
                  onClick={async () => { const r = await anularDevolucion(socioId, d.id, motivo, reintegro); if (r.error) setError(r.error); else cerrar(); }}>🚫 Anular la devolución</BotonAccion>
                <button type="button" className="boton" onClick={cerrar}>Cancelar</button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
