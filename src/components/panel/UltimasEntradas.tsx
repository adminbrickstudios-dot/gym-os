"use client";
import { useEffect, useState } from "react";
import { LinkPanel } from "@/components/panel/LinkPanel";
import { ultimasEntradas } from "@/app/panel/inicio-acciones";

export type EntradaVivo = {
  ingreso_id: string; socio_id: string; socio: string; momento: string; via: string;
  resultado: string; color: string; texto: string; cobrar: boolean;
};

const VIA: Record<string, string> = { recepcion: "recepción", qr_socio: "QR", qr_pared: "QR de la pared", kiosco: "tablet", nfc: "llavero", molinete: "molinete" };
const CADA_MS = 20_000;

/** VD-12b: las últimas entradas de hoy, en vivo (se renueva sola cada 20 s mientras la pestaña se ve). */
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
    return () => { vivo = false; clearInterval(id); document.removeEventListener("visibilitychange", renovar); };
  }, []);
  const hora = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  return (
    <div data-ultimas-entradas={lista.length}>
      {lista.length === 0 ? (
        <p className="texto-suave text-lg">Todavía no entró nadie hoy. Cuando entren, las ves acá. 🚪</p>
      ) : (
        <ul className="space-y-2">
          {lista.map((x) => {
            const bien = x.resultado === "entro" || x.resultado === "entro_modo_aviso";
            const emoji = x.resultado === "rechazado" ? "⛔" : x.resultado === "forzado" ? "⚠️" : bien && x.color === "verde" ? "✅" : "⚠️";
            return (
              <li key={x.ingreso_id} data-entrada-vivo={x.resultado} className="tarjeta flex flex-wrap items-center gap-3 px-4 py-3 min-h-[68px]">
                <span className="text-2xl" aria-hidden>{emoji}</span>
                <LinkPanel href={`/panel/socios/${x.socio_id}`} siNoEsta="texto" className="min-w-0 flex-1" textoClassName="min-w-0 flex-1">
                  <span className="block font-semibold text-lg truncate">{x.socio}</span>
                  <span className="block texto-suave truncate"><span className="numero">{hora(x.momento)}</span> · {VIA[x.via] ?? x.via}{!bien || x.color !== "verde" ? ` · ${x.texto}` : ""}</span>
                </LinkPanel>
                {x.cobrar && <LinkPanel href={`/panel/vender?socio=${x.socio_id}&cuota=1`} className="boton !min-h-11" >💵 Cobrar</LinkPanel>}
              </li>
            );
          })}
        </ul>
      )}
      {falloRenovar && <p className="texto-tenue text-sm mt-2" role="status">No se pudo renovar; se ve lo último que llegó.</p>}
    </div>
  );
}
