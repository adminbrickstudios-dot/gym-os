"use client";
// VD-4 · Un solo "oído" a la puerta para todo el panel (docs/v2/01 §5).
// Cada 4 s, y solo con la pestaña a la vista, le pregunta a la base qué entró o se rechazó desde el último cursor
// (`entradas_desde`) y se lo avisa a quien esté suscripto: los avisos de vidrio, la barra fija y la lista "Hoy".
// Aunque haya tres componentes escuchando, hay UN solo pedido cada 4 s. Sin Realtime por ahora: cuando se
// quiera, solo cambia `pedir` (la imitación local no lo tiene y no hace falta).
import { entradasDesde, type LoteEntradas } from "@/app/panel/entrada/ventana-acciones";

export const CADA_MS = 4000;
/** Se pide con un poco de solape y se descartan los ya vistos: una entrada que se confirma tarde no se pierde. */
const SOLAPE_MS = 10_000;

type Oyente = (lote: LoteEntradas) => void;

const oyentes = new Set<Oyente>();
let gimnasio: string | null = null;
let cursor: string | null = null;
let reloj: ReturnType<typeof setInterval> | null = null;
let enVuelo = false;
const vistos = new Set<string>();

const visible = () => typeof document === "undefined" || document.visibilityState === "visible";

async function pedir() {
  if (enVuelo || !gimnasio || !visible()) return;
  enVuelo = true;
  const g = gimnasio;
  try {
    const desde = cursor ? new Date(Date.parse(cursor) - SOLAPE_MS).toISOString() : null;
    const r = await entradasDesde(g, desde);
    if (g !== gimnasio || !r.lote) return;   // sin conexión o error: se reintenta en el próximo ciclo, sin avisar
    const nuevas = r.lote.entradas.filter((x) => !vistos.has(x.ingreso_id));
    const nuevasAlertas = r.lote.alertas.filter((x) => !vistos.has(x.alerta_id));
    for (const x of nuevas) vistos.add(x.ingreso_id);
    for (const x of nuevasAlertas) vistos.add(x.alerta_id);
    if (vistos.size > 500) [...vistos].slice(0, 250).forEach((k) => vistos.delete(k));
    const primera = cursor === null;
    cursor = r.lote.hasta;
    if (!primera && (nuevas.length || nuevasAlertas.length)) {
      const lote: LoteEntradas = { ...r.lote, entradas: nuevas, alertas: nuevasAlertas };
      oyentes.forEach((o) => o(lote));
    }
  } finally { enVuelo = false; }
}

const alVolver = () => { if (visible()) void pedir(); };

function arrancar() {
  if (reloj) return;
  void pedir();
  reloj = setInterval(() => { void pedir(); }, CADA_MS);
  document.addEventListener("visibilitychange", alVolver);
}
function parar() {
  if (reloj) clearInterval(reloj);
  reloj = null; cursor = null; enVuelo = false; vistos.clear();
  document.removeEventListener("visibilitychange", alVolver);
}

/** Escucha lo que entra por la puerta. Devuelve la función para dejar de escuchar. */
export function escucharEntradas(gimnasioId: string, oyente: Oyente): () => void {
  if (gimnasio !== gimnasioId) { parar(); gimnasio = gimnasioId; }
  oyentes.add(oyente);
  arrancar();
  return () => {
    oyentes.delete(oyente);
    if (oyentes.size === 0) { parar(); gimnasio = null; }
  };
}
