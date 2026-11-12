"use client";
// Lo que pasó hoy en la puerta. Cada entrada se puede anular con un motivo
// (la recepción solo en los primeros 5 minutos; después, el dueño o el
// encargado: lo decide la base).
import { useState, useTransition } from "react";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { PuntoEstado } from "@/components/panel/Estado";
import { anularEntrada } from "./acciones";
import { Icono } from "@/components/ui/Icono";

export type Ingreso = { ingreso_id: string; momento: string; socio_id: string; socio: string; numero: number; resultado: string; color: string; texto: string; via_acceso: string; registrado_por: string | null };
const ETIQUETA: Record<string, string> = { entro: "Entró", entro_modo_aviso: "Entró con aviso", forzado: "Lo dejaron pasar", rechazado: "No pudo entrar" };
const VIA: Record<string, string> = { recepcion: "", qr_socio: " · con QR", qr_pared: " · QR de la pared", kiosco: " · en la tablet", nfc: " · con llavero", molinete: " · molinete" };

export function Hoy({ ingresos, zona }: { ingresos: Ingreso[]; zona: string }) {
  const [anulando, setAnulando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  const entraron = new Set(ingresos.filter((i) => i.resultado !== "rechazado").map((i) => i.socio_id)).size;
  return (
    <section aria-labelledby="hoy" data-hoy={ingresos.length}>
      <h2 id="hoy" className="titulo text-2xl mb-1">Hoy</h2>
      <p className="texto-suave mb-4">{entraron === 1 ? "Entró 1 socio" : `Entraron ${entraron} socios`}</p>
      {error && <p role="alert" className="pildora pildora-rojo whitespace-normal mb-3"><Icono nombre="alerta" /> {error}</p>}
      {ingresos.length === 0 ? <p className="texto-tenue">Todavía no entró nadie.</p> : (
        <ul className="space-y-1">
          {ingresos.slice(0, 40).map((i) => (
            <li key={i.ingreso_id} data-ingreso={i.resultado}>
              <div className="flex items-center gap-1">
                <LinkPanel href={`/panel/socios/${i.socio_id}`} siNoEsta="texto" className="min-w-0 flex-1 flex items-center gap-3 rounded-[var(--radio)] px-2 py-2 hover:bg-[var(--tarjeta)]" textoClassName="min-w-0 flex-1 flex items-center gap-3 rounded-[var(--radio)] px-2 py-2">
                  <span className="numero text-lg w-12 flex-none texto-suave">{hora(i.momento)}</span>
                  <PuntoEstado color={i.resultado === "rechazado" ? "rojo" : i.resultado === "forzado" ? "naranja" : i.color} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold truncate">{i.socio}</span>
                    <span className="block text-sm texto-tenue truncate">
                      {ETIQUETA[i.resultado] ?? i.resultado}{VIA[i.via_acceso] ?? ""}{i.resultado === "forzado" && i.registrado_por ? ` (${i.registrado_por})` : ""}{i.resultado !== "entro" ? ` · ${i.texto}` : ""}
                    </span>
                  </span>
                </LinkPanel>
                {anulando !== i.ingreso_id && (
                  <button type="button" className="flex-none size-11 rounded-[var(--radio)] texto-tenue hover:bg-[var(--tarjeta)]" aria-label={`Anular la entrada de ${i.socio}`}
                    onClick={() => { setAnulando(i.ingreso_id); setMotivo(""); setError(null); }}><Icono nombre="papelera" /></button>
                )}
              </div>
              {anulando === i.ingreso_id && (
                <form className="flex flex-wrap gap-2 px-2 pb-2" onSubmit={(e) => { e.preventDefault(); empezar(async () => {
                  const r = await anularEntrada(i.ingreso_id, motivo);
                  if (r.error) setError(r.error); else { setAnulando(null); setError(null); }
                }); }}>
                  <input autoFocus className="campo flex-1 basis-40" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="¿Por qué se anula?" aria-label="Por qué se anula la entrada" />
                  <button type="submit" className="boton boton-peligro" disabled={ocupado || !motivo.trim()}>Anular</button>
                  <button type="button" className="boton" onClick={() => setAnulando(null)}>Cancelar</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {ingresos.length > 40 && <p className="texto-tenue text-[13px] mt-2" data-hoy-recortada>Se ven las 40 más recientes de {ingresos.length} de hoy.</p>}
    </section>
  );
}
