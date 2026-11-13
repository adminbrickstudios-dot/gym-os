"use client";
import { useEffect, useState } from "react";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { BotonCobrar } from "@/components/panel/cobrar/BotonCobrar";
import { ultimasEntradas } from "@/app/panel/inicio-acciones";
import { Icono } from "@/components/ui/Icono";
import { EVENTO_ENTRADAS_NUEVAS } from "@/components/panel/entradas-vivo";

export type EntradaVivo = {
  ingreso_id: string; socio_id: string; socio: string; momento: string; via: string;
  resultado: string; color: string; texto: string; cobrar: boolean;
};

const VIA: Record<string, string> = { recepcion: "recepción", qr_socio: "QR", qr_pared: "QR de la pared", kiosco: "tablet", nfc: "llavero", molinete: "molinete" };
const CADA_MS = 60_000;   // E5: lo nuevo llega por el oído de la puerta (Realtime); esto es solo la red de seguridad

/** VD-12b: las últimas entradas de hoy, en vivo (se renueva al instante cuando entra alguien —evento del oído de la puerta, Realtime— y, de red de seguridad, cada 60 s mientras la pestaña se ve). */
export function UltimasEntradas({ iniciales, zona }: { iniciales: EntradaVivo[]; zona: string }) {
  const [lista, setLista] = useState(iniciales);
  const [falloRenovar, setFalloRenovar] = useState(false);
  useEffect(() => {
    let vivo = true;
    const renovar = async () => {
      if (document.visibilityState !== "visible") return;
      const r = await ultimasEntradas();
      if (!vivo) return;
      if (r.error || !r.entradas) { setFalloRenovar(true); return; }
      setFalloRenovar(false); setLista(r.entradas);
    };
    const id = setInterval(renovar, CADA_MS);
    document.addEventListener("visibilitychange", renovar);
    window.addEventListener(EVENTO_ENTRADAS_NUEVAS, renovar);
    return () => { vivo = false; clearInterval(id); document.removeEventListener("visibilitychange", renovar); window.removeEventListener(EVENTO_ENTRADAS_NUEVAS, renovar); };
  }, []);
  const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  return (
    <div data-ultimas-entradas={lista.length}>
      {lista.length === 0 ? (
        <p className="texto-suave text-lg">Todavía no entró nadie hoy. Cuando entren, las ves acá. <Icono nombre="puerta" /></p>
      ) : (
        <ul className="space-y-2">
          {lista.map((x) => {
            const bien = x.resultado === "entro" || x.resultado === "entro_modo_aviso";
            const emoji = x.resultado === "rechazado" ? "prohibido" : x.resultado === "forzado" ? "alerta" : bien && x.color === "verde" ? "ok" : "alerta";
            return (
              <li key={x.ingreso_id} data-entrada-vivo={x.resultado} className="tarjeta flex flex-wrap items-center gap-3 px-4 py-3 min-h-[68px]">
                <span className="text-2xl" aria-hidden><Icono nombre={emoji} sistema /></span>
                <LinkPanel href={`/panel/socios/${x.socio_id}`} siNoEsta="texto" className="min-w-0 flex-1" textoClassName="min-w-0 flex-1">
                  <span className="block font-semibold text-lg truncate">{x.socio}</span>
                  <span className="block texto-suave truncate"><span className="numero">{hora(x.momento)}</span> · {VIA[x.via] ?? x.via}{!bien || x.color !== "verde" ? ` · ${x.texto}` : ""}</span>
                </LinkPanel>
                {x.cobrar && <BotonCobrar socioId={x.socio_id} origen="otro" cuota className="boton !min-h-11"><Icono nombre="plata" /> Cobrar</BotonCobrar>}
              </li>
            );
          })}
        </ul>
      )}
      {falloRenovar && <p className="texto-tenue text-sm mt-2" role="status">No se pudo renovar; se ve lo último que llegó.</p>}
    </div>
  );
}
