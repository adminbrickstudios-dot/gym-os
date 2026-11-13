"use client";
// VD-4 + E3 · Un solo "oído" a la puerta para todo el panel.
// Con Supabase Realtime (un canal por gimnasio, con la sesión de quien mira, así que solo llega lo que su rol puede leer) cada entrada
// nueva avisa al instante; el aviso en sí se arma con `entradas_desde` (la misma función de siempre, nada se calcula en TypeScript:
// Realtime solo dice "hay algo nuevo"). Aunque haya tres componentes escuchando, hay UN solo canal.
// Si Realtime se cae, vuelve al pedido periódico CADA 30 s y lo dice (estadoAvisos() = "con_demora"): nunca un fallback silencioso.
// Contra una base local (localhost) no hay Realtime (la imitación local no lo tiene): ahí el pedido es cada 4 s, y lo dice el estado
// ("periodico"). Además, al volver a la pestaña se pide enseguida: lo que pasó mientras no se miraba no se pierde.
import { entradasDesde, type LoteEntradas } from "@/app/panel/entrada/ventana-acciones";

/** E5: se dispara en la ventana cada vez que llega una entrada nueva: las listas del panel (Últimas entradas) se renuevan al instante, sin pedidos periódicos. */
export const EVENTO_ENTRADAS_NUEVAS = "gymos:entradas-nuevas";

/** Cada cuánto se pide cuando NO hay Realtime (base local). */
export const CADA_MS = 4000;
/** Cada cuánto se pide cuando Realtime se cayó: lento a propósito (carga sobre la base), y se avisa en chico. */
export const CADA_CAIDO_MS = 30_000;
/** Se pide con un poco de solape y se descartan los ya vistos: una entrada que se confirma tarde no se pierde. */
const SOLAPE_MS = 10_000;

/** al_instante: Realtime andando · con_demora: Realtime caído, se pide cada 30 s · periodico: sin Realtime (base local), cada 4 s. */
export type EstadoAvisos = "al_instante" | "con_demora" | "periodico";

type Oyente = (lote: LoteEntradas) => void;

const oyentes = new Set<Oyente>();
const oyentesEstado = new Set<(e: EstadoAvisos) => void>();
let estado: EstadoAvisos = "periodico";
let gimnasio: string | null = null;
let cursor: string | null = null;
let reloj: ReturnType<typeof setInterval> | null = null;
let enVuelo = false;
let pendiente = false;
let canal: { unsubscribe: () => unknown } | null = null;
// E4: el cliente de Supabase (auth + realtime + postgrest + storage) NO viaja con cada pantalla del panel: se baja con import()
// recién cuando se abre el canal. Mientras baja (o si falla) corre el pedido de plan B que arma arrancar().
const traerCliente = async () => (await import("@/lib/supabase/navegador")).crearClienteNavegador();
let cliente: Awaited<ReturnType<typeof traerCliente>> | null = null;
let generacion = 0;   // cada parar() la sube: un canal que termina de bajar después de parar no se abre
const vistos = new Set<string>();

const visible = () => typeof document === "undefined" || document.visibilityState === "visible";
const hayRealtime = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return !!url && !/\/\/(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:|\/|$)/.test(url);
};

export const estadoAvisos = () => estado;
/** Avisa cuando cambia el estado del oído (para decir "avisos con demora" en chico). Devuelve la función para dejar de escuchar. */
export function escucharEstadoAvisos(f: (e: EstadoAvisos) => void): () => void {
  oyentesEstado.add(f);
  f(estado);
  return () => { oyentesEstado.delete(f); };
}
function poner(e: EstadoAvisos) {
  if (estado === e) return;
  estado = e;
  oyentesEstado.forEach((f) => f(e));
}

async function pedir() {
  if (!gimnasio || !visible()) return;
  if (enVuelo) { pendiente = true; return; }   // llegó otro aviso mientras se pedía: se vuelve a pedir apenas termine
  enVuelo = true;
  const g = gimnasio;
  try {
    const desde = cursor ? new Date(Date.parse(cursor) - SOLAPE_MS).toISOString() : null;
    const r = await entradasDesde(g, desde);
    if (g !== gimnasio || !r.lote) return;   // sin conexión o error: se reintenta en el próximo ciclo o aviso
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
      if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_ENTRADAS_NUEVAS));
    }
  } finally {
    enVuelo = false;
    if (pendiente) { pendiente = false; void pedir(); }
  }
}

const alVolver = () => { if (visible()) void pedir(); };

function arrancarReloj(ms: number) {
  if (reloj) clearInterval(reloj);
  reloj = setInterval(() => { void pedir(); }, ms);
}
function pararReloj() {
  if (reloj) clearInterval(reloj);
  reloj = null;
}

async function abrirCanal(g: string) {
  const gen = generacion;
  try {
    cliente ??= await traerCliente();
    if (gen !== generacion || g !== gimnasio) return;   // se paró mientras bajaba el cliente
    const filtro = `gimnasio_id=eq.${g}`;
    const c = cliente
      .channel(`entradas-${g}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ingresos", filter: filtro }, () => { void pedir(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "ingresos", filter: filtro }, () => { void pedir(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alertas_prestamo", filter: filtro }, () => { void pedir(); })
      .subscribe((s) => {
        if (g !== gimnasio) return;
        if (s === "SUBSCRIBED") { pararReloj(); poner("al_instante"); void pedir(); }   // al conectar (o reconectar) se pone al día
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") { poner("con_demora"); arrancarReloj(CADA_CAIDO_MS); }
      });
    canal = c;
  } catch {
    if (gen !== generacion) return;
    poner("con_demora");
    arrancarReloj(CADA_CAIDO_MS);
  }
}

function arrancar() {
  if (canal || reloj) return;
  void pedir();
  document.addEventListener("visibilitychange", alVolver);
  if (gimnasio && hayRealtime()) {
    // Hasta que el canal confirme, se pide cada 30 s: si nunca conecta, ya está el plan B (y "con demora" lo dice el canal).
    arrancarReloj(CADA_CAIDO_MS);
    void abrirCanal(gimnasio);
  } else {
    poner("periodico");
    arrancarReloj(CADA_MS);
  }
}
function parar() {
  generacion++;
  pararReloj();
  if (canal) { void canal.unsubscribe(); canal = null; }
  cursor = null; enVuelo = false; pendiente = false; vistos.clear();
  poner("periodico");
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
