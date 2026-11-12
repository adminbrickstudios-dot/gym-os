"use client";
// N4 · "De dónde vienen los socios nuevos": el reporte simple (altas y cuántos pagaron, por canal, últimos 30 días), las últimas altas con
// su origen y los links de "Quiero ser socio" para copiar. Solo se muestra si el gimnasio prendió la función (si no, la página ni lo pide).
import { useState } from "react";
import { Icono } from "@/components/ui/Icono";
import { fechaCorta } from "@/lib/formato";
import type { CanalAlta, OrigenAltasDatos } from "./origen-altas";

export const NOMBRE_CANAL: Record<CanalAlta, string> = { instagram: "Instagram", qr_cartel: "QR del cartel", whatsapp: "WhatsApp", recomendado: "Recomendado" };

export function OrigenAltas({ datos, zona }: { datos: OrigenAltasDatos; zona: string }) {
  const { reporte: r, links } = datos;
  const [copiado, setCopiado] = useState<string | null>(null);
  const copiar = async (canal: string, url: string) => {
    try { await navigator.clipboard.writeText(url); setCopiado(canal); setTimeout(() => setCopiado(null), 2000); } catch { setCopiado(null); }
  };
  return (
    <section className="tarjeta p-5 sm:p-6 space-y-4" data-origen-altas={r.total}>
      <div>
        <h2 className="titulo text-2xl">De dónde vienen los socios nuevos</h2>
        <p className="texto-suave">Últimos {r.dias} días: {r.total === 0 ? "todavía no se anotó nadie por un link con origen." : `${r.total} ${r.total === 1 ? "alta" : "altas"} con origen.`}{r.sin_origen > 0 ? ` Otras ${r.sin_origen} se anotaron por un link sin origen.` : ""}</p>
      </div>
      <table className="w-full text-left" data-origen-tabla>
        <thead><tr className="texto-tenue text-sm"><th className="py-1 font-normal">Origen</th><th className="py-1 font-normal text-right">Altas</th><th className="py-1 font-normal text-right">Pagaron</th></tr></thead>
        <tbody>
          {r.canales.map((c) => (
            <tr key={c.canal} className="border-t" data-origen-canal={c.canal}>
              <td className="py-2">{NOMBRE_CANAL[c.canal]}</td>
              <td className="py-2 text-right numero" data-altas>{c.altas}</td>
              <td className="py-2 text-right numero" data-pagaron>{c.pagaron}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {r.ultimas.length > 0 && (
        <div>
          <p className="font-semibold">Últimas altas</p>
          <ul className="text-sm texto-suave" data-origen-ultimas>
            {r.ultimas.map((u) => <li key={u.socio_id}>{fechaCorta(u.creado_en, zona)} · {u.nombre} · {NOMBRE_CANAL[u.canal]} · {u.pago ? "ya pagó" : "todavía no pagó"}</li>)}
          </ul>
        </div>
      )}
      <details>
        <summary className="boton cursor-pointer inline-flex"><Icono nombre="enlace" /> Links para cada lugar</summary>
        <ul className="mt-3 space-y-2" data-origen-links>
          {links.map((l) => (
            <li key={l.canal} className="flex flex-wrap items-center gap-2">
              <span className="w-36 font-semibold">{NOMBRE_CANAL[l.canal]}</span>
              <code className="text-sm break-all flex-1 min-w-[12rem]" data-link-canal={l.canal}>{l.url}</code>
              <button type="button" className="boton" onClick={() => copiar(l.canal, l.url)}>{copiado === l.canal ? "Copiado" : "Copiar"}</button>
            </li>
          ))}
        </ul>
        <p className="texto-suave text-sm mt-2">Poné cada link donde corresponde (la bio de Instagram, el QR del cartel, el mensaje de WhatsApp). Quien se anote por él queda con ese origen.</p>
      </details>
    </section>
  );
}
