"use client";
import { useState, useTransition } from "react";
import { verTicket } from "@/app/panel/caja/acciones";
import { formatearPesos } from "@/lib/formato";

export type AlertaCaja = { tipo: "diferencia" | "retiro" | "anulacion" | "descuento"; en: string; monto: number; texto: string | null; por: string | null;
  caja?: string; movimiento_id?: string; ticket?: boolean; porcentaje?: number };

const EMOJI = { diferencia: "⚖️", retiro: "➖", anulacion: "↩️", descuento: "🏷️" } as const;

function titulo(a: AlertaCaja): string {
  switch (a.tipo) {
    case "diferencia": return `${a.caja ?? "La caja"} cerró con ${a.monto < 0 ? `${formatearPesos(-a.monto)} de menos` : `${formatearPesos(a.monto)} de más`}`;
    case "retiro": return `Salieron ${formatearPesos(a.monto)} del cajón`;
    case "anulacion": return `Se anuló una venta de ${formatearPesos(a.monto)}`;
    case "descuento": return `Descuento de ${formatearPesos(a.monto)} (${a.porcentaje} %)`;
  }
}

/** CAJ-4: lo que pasó con la plata y no hizo quien mira (se calcula, no se guarda). */
export function AlertasCaja({ alertas, zona }: { alertas: AlertaCaja[]; zona: string }) {
  const [error, setError] = useState<string | null>(null);
  const [, empezar] = useTransition();
  const cuando = (m: string) => new Intl.DateTimeFormat("es-AR", { timeZone: zona, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(m));
  const ticket = (id: string) => {
    const pestana = window.open("", "_blank");
    empezar(async () => {
      const r = await verTicket(id);
      if (r.url && pestana) { pestana.opener = null; pestana.location.href = r.url; }
      else { pestana?.close(); setError(r.error ?? null); }
    });
  };
  return (
    <section aria-labelledby="alertas-caja" data-alertas-caja={alertas.length}>
      <h2 id="alertas-caja" className="titulo text-3xl mb-1">🔔 Caja</h2>
      <p className="texto-suave mb-4">Lo de los últimos 7 días que hizo otro: diferencias, retiros, anulaciones y descuentos grandes.</p>
      <ul className="space-y-2">
        {alertas.slice(0, 12).map((a, i) => (
          <li key={i} className="tarjeta px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1" data-alerta={a.tipo}>
            <span aria-hidden className="text-xl">{EMOJI[a.tipo]}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{titulo(a)}</span>
              <span className="block text-sm texto-suave">{cuando(a.en)}{a.por ? ` · ${a.por}` : ""}{a.texto ? ` · “${a.texto}”` : ""}</span>
            </span>
            {a.tipo === "retiro" && a.ticket && a.movimiento_id && <button type="button" className="boton boton-chico" onClick={() => ticket(a.movimiento_id!)}>🧾 Ver ticket</button>}
            {a.tipo === "retiro" && !a.ticket && <span className="text-sm texto-tenue">sin foto del ticket</span>}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="pildora pildora-rojo mt-2">⚠️ {error}</p>}
    </section>
  );
}
