"use client";
import { usePathname } from "next/navigation";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { BotonCobrar } from "@/components/panel/cobrar/BotonCobrar";
import { useOptimistic, useState, useTransition } from "react";
import { anotarContacto } from "@/app/panel/retencion/acciones";
import { marcarAvisado } from "@/app/panel/avisos/acciones";
import { Icono } from "@/components/ui/Icono";

/**
 * Un socio para contactar: el porqué, el mensaje armado por WhatsApp y,
 * si la persona puede, anotar que se le escribió (así nadie le escribe dos veces).
 */
export function FilaContacto({ socioId, nombre, texto, detalle, whatsapp, lista, ultimo, puedeAnotar, cobrar = false, aviso, tarea = false }: {
  socioId: string; nombre: string; texto: string; detalle?: string | null; whatsapp: string | null; lista: string;
  ultimo?: string | null; puedeAnotar: boolean;
  /** AUD-7: "Cobrar" lleva a Vender con su cuota cargada (si Vender está prendido y el rol cobra). */
  cobrar?: boolean;
  /** VEH-1: tocar WhatsApp también deja "avisado ✓" en la bandeja (la recepción incluida). */
  aviso?: { clave: string; referencia: string } | null;
  /** COM-4: "Tarea" para anotar algo sobre este socio (llamarlo otro día, por ejemplo). */
  tarea?: boolean;
}) {
  const ruta = usePathname();
  const [anotadoReal, setAnotado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, empezar] = useTransition();
  // VD-47X: el "anotado" aparece al instante; si la base dice que no, vuelve atrás y muestra el error.
  const [anotado, anotarYa] = useOptimistic<string | null, string>(anotadoReal, (_, r) => r);
  const anotar = (resultado: string) => empezar(async () => {
    setError(null);
    anotarYa(resultado);
    const r = await anotarContacto(socioId, lista, resultado);
    if (r.error) setError(r.error); else setAnotado(resultado);
  });
  return (
    <li className="tarjeta p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <LinkPanel href={`/panel/socios/${socioId}`} siNoEsta="texto" className="font-semibold text-lg hover:underline" textoClassName="font-semibold text-lg">{nombre}</LinkPanel>
          <p className="texto-suave">{texto}</p>
          {detalle && <p className="text-sm texto-tenue mt-0.5">{detalle}</p>}
          {(anotado || ultimo) && <p className="text-sm mt-1" style={{ color: "var(--acento)" }}><Icono nombre="ok" /> {anotado ? "Anotado recién" : ultimo}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {whatsapp
            ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="boton !min-h-11" onClick={() => { if (aviso) void marcarAvisado(socioId, aviso.clave, aviso.referencia); if (puedeAnotar && !anotado) anotar("enviado"); }}><Icono nombre="mensaje" /> WhatsApp</a>
            : <span className="pildora"><Icono nombre="prohibido" /> Sin teléfono</span>}
          {cobrar && <BotonCobrar socioId={socioId} cuota origen={ruta.includes("retencion") ? "retencion" : "vencen"} className="boton !min-h-11"><Icono nombre="plata" /> Cobrar</BotonCobrar>}
          {puedeAnotar && !anotado && <button type="button" disabled={ocupado} className="boton !min-h-11" onClick={() => anotar("vuelve")}><Icono nombre="persona" /> Dice que vuelve</button>}
          {tarea && <LinkPanel href={`/panel/tareas?socio=${socioId}`} className="boton !min-h-11"><Icono nombre="chincheta" /> Tarea</LinkPanel>}
        </div>
      </div>
      {error && <p role="alert" className="pildora pildora-rojo mt-3"><Icono nombre="alerta" /> {error}</p>}
    </li>
  );
}
