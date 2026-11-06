// VD-5 · La hoja Cobrar se abre desde cualquier pantalla con un evento: así ninguna pantalla
// importa a la otra y todas usan el mismo flujo (docs/v2/02 §2).

export const EVENTO_COBRAR = "gymos:cobrar";
/** Se cobró: lo escuchan la Entrada (vuelve con el veredicto nuevo) y quien necesite enterarse. */
export const EVENTO_COBRO_HECHO = "gymos:cobro-hecho";
/** La hoja se cerró (con o sin cobro): la Entrada vuelve a mostrarse. */
export const EVENTO_COBRAR_CERRADO = "gymos:cobrar-cerrado";

/** De dónde se abrió: es adonde vuelve al terminar. */
export type OrigenCobro = "entrada" | "ficha" | "vencen" | "retencion" | "buscador" | "otro";

export type PedidoCobro = { socioId: string; origen: OrigenCobro; sedeId?: string };
export type CobroHecho = { socioId: string; ventaId: string; total: number; origen: OrigenCobro };

/** true si el panel tiene la hoja montada (si no, el link normal lleva a Vender). */
export const hayHojaCobrar = () => typeof document !== "undefined" && document.documentElement.dataset.cobrarHoja === "si";

export function abrirCobrar(pedido: PedidoCobro) {
  window.dispatchEvent(new CustomEvent<PedidoCobro>(EVENTO_COBRAR, { detail: pedido }));
}
