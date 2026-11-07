"use client";
import { useState } from "react";
import { BotonAccion } from "@/components/ui/BotonAccion";
import { Mensaje } from "@/components/ui/Mensaje";
import { refrescarPendientes } from "@/lib/panel/pendientes";
import { revisarConMercadoPago, type ResultadoRevision } from "./acciones";

/** VD-46A: "Revisar con MercadoPago": el dueño y el encargado reconsultan lo dudoso a mano (no hay cron). */
export function RevisarMP() {
  const [r, setR] = useState<ResultadoRevision | null>(null);
  const correr = async () => {
    const x = await revisarConMercadoPago();
    setR(x);
    if (!x.error) refrescarPendientes();
  };
  const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);
  const texto = !r ? null
    : r.sinMercadoPago ? "MercadoPago no está conectado: se conecta en Configuración → Cobros."
    : r.revisados === 0 ? "No había nada para revisar: no hay pagos colgados ni aprobados recientes sin mirar."
    : `Revisé ${r.revisados} ${plural(r.revisados ?? 0, "pago", "pagos")}. ${r.cambios ? `${r.cambios} ${plural(r.cambios, "cambió", "cambiaron")} (acreditado, devuelto o rechazado).` : "Todo coincide con MercadoPago."}${r.fallaron ? ` ${r.fallaron} no se pudo consultar: probá de nuevo en un rato.` : ""}`;
  return (
    <section className="tarjeta p-4 space-y-3" data-revisar-mp>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Pagos con MercadoPago</p>
          <p className="texto-suave">Compara con MercadoPago los pagos que quedaron colgados y los del último mes. Si devolvieron o contracargaron uno, se anula la venta y el socio pierde el acceso.</p>
        </div>
        <BotonAccion className="boton" ocupadoTexto="Revisando…" onClick={correr}>🔄 Revisar con MercadoPago</BotonAccion>
      </div>
      {r?.error && <Mensaje tipo="error">{r.error}</Mensaje>}
      {texto && !r?.error && <Mensaje tipo={r?.fallaron ? "aviso" : "exito"}>{texto}</Mensaje>}
    </section>
  );
}
