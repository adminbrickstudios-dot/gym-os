"use client";
// VD-5 · La hoja Cobrar vive acá, una sola vez en todo el panel. Se abre con `abrirCobrar()`
// (ficha, Vencen hoy, Retención, Entrada, Ctrl+K) y al terminar vuelve al lugar de origen.
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Cobrar } from "./Cobrar";
import { EVENTO_COBRAR, EVENTO_COBRAR_CERRADO, EVENTO_COBRO_HECHO, type CobroHecho, type PedidoCobro } from "./evento";

export function CobrarHost({ sedeId }: { sedeId: string }) {
  const [pedido, setPedido] = useState<(PedidoCobro & { n: number }) | null>(null);
  const [hizoCobro, setHizoCobro] = useState(false);
  const ruta = usePathname();
  const router = useRouter();

  useEffect(() => {
    document.documentElement.dataset.cobrarHoja = "si";
    const abrir = (e: Event) => { setHizoCobro(false); setPedido({ ...(e as CustomEvent<PedidoCobro>).detail, n: Date.now() }); };
    window.addEventListener(EVENTO_COBRAR, abrir);
    return () => { window.removeEventListener(EVENTO_COBRAR, abrir); delete document.documentElement.dataset.cobrarHoja; };
  }, []);

  const cerrar = () => {
    setPedido(null);
    window.dispatchEvent(new Event(EVENTO_COBRAR_CERRADO));
    // Volver al origen: la pantalla de atrás se entera de lo cobrado.
    if (hizoCobro) router.refresh();
  };
  // Al cambiar de pantalla la hoja se cierra sola.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (pedido) cerrar(); }, [ruta]);

  if (!pedido) return null;
  return (
    <Cobrar key={pedido.n} sedeId={pedido.sedeId ?? sedeId} socioId={pedido.socioId} origen={pedido.origen} alCerrar={cerrar}
      alCobrado={(venta) => {
        setHizoCobro(true);
        const hecho: CobroHecho = { socioId: pedido.socioId, ventaId: venta.venta_id, total: venta.total, origen: pedido.origen };
        window.dispatchEvent(new CustomEvent<CobroHecho>(EVENTO_COBRO_HECHO, { detail: hecho }));
        // Desde la Entrada no hay pantalla de "listo": vuelve ya, con el veredicto nuevo, para anotar con Enter.
        if (pedido.origen === "entrada") { setPedido(null); window.dispatchEvent(new Event(EVENTO_COBRAR_CERRADO)); router.refresh(); }
      }} />
  );
}
