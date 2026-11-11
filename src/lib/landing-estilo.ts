// P8 / P8b · Estilo de la página del gimnasio y lógica del editor. Funciones puras, con pruebas.
import type { CSSProperties } from "react";
import type { ClaseSemana, Marca } from "@/lib/landing";
import { FONDO_CLARO } from "@/lib/marca";

export type Tipografia = NonNullable<Marca["tipografia"]>;

/** La letra de los títulos. Usa solo las fuentes que la plataforma ya carga (Barlow, Barlow Condensed) y una serif del sistema. */
export const TIPOGRAFIAS: { id: Tipografia; nombre: string; detalle: string; css: string }[] = [
  { id: "condensada", nombre: "Condensada", detalle: "Alta y apretada, de cartel de gimnasio", css: "var(--font-barlow-condensed), var(--font-barlow), ui-sans-serif, system-ui, sans-serif" },
  { id: "ancha", nombre: "Ancha", detalle: "Más abierta y redonda", css: "var(--font-barlow), ui-sans-serif, system-ui, sans-serif" },
  { id: "clasica", nombre: "Clásica", detalle: "Con serifa, más sobria", css: "Georgia, 'Times New Roman', ui-serif, serif" },
];

export const esTipografia = (t: unknown): t is Tipografia => TIPOGRAFIAS.some((x) => x.id === t);

/** Variable CSS de la letra de títulos para el contenedor de la página. Sin dato o con un valor raro: la condensada. */
export function estiloTipografia(t: string | null | undefined): CSSProperties {
  const css = (TIPOGRAFIAS.find((x) => x.id === t) ?? TIPOGRAFIAS[0]).css;
  return { ["--fuente-titulo" as string]: css };
}

/** Lo que vale "Restaurar por defecto" para el estilo: el mismo que usa la base (pagina_por_defecto). */
export const ESTILO_POR_DEFECTO = { color_acento: "#16a34a", color_fondo: FONDO_CLARO.toLowerCase(), tipografia: "condensada" as Tipografia };

// ── Mover y deshacer (el editor) ────────────────────────────────────

/** La lista con el elemento de `desde` puesto en `hasta` (arrastrar). Fuera de rango o igual: la misma lista. */
export function mover<T>(lista: readonly T[], desde: number, hasta: number): T[] {
  if (desde === hasta || desde < 0 || hasta < 0 || desde >= lista.length || hasta >= lista.length) return [...lista];
  const r = [...lista];
  const [x] = r.splice(desde, 1);
  r.splice(hasta, 0, x);
  return r;
}

/** Historial para deshacer y rehacer. `pasado` termina en lo anterior al estado actual. */
export type Historial<T> = { pasado: T[]; actual: T; futuro: T[] };
export const MAX_HISTORIAL = 50;

export const nuevoHistorial = <T,>(inicial: T): Historial<T> => ({ pasado: [], actual: inicial, futuro: [] });

/** Registra un cambio. Si no cambió nada (mismo contenido), no suma un paso. Un cambio nuevo borra lo que se podía rehacer. */
export function registrar<T>(h: Historial<T>, nuevo: T): Historial<T> {
  if (JSON.stringify(h.actual) === JSON.stringify(nuevo)) return h;
  return { pasado: [...h.pasado, h.actual].slice(-MAX_HISTORIAL), actual: nuevo, futuro: [] };
}
export const puedeDeshacer = <T,>(h: Historial<T>) => h.pasado.length > 0;
export const puedeRehacer = <T,>(h: Historial<T>) => h.futuro.length > 0;
export function deshacer<T>(h: Historial<T>): Historial<T> {
  if (!h.pasado.length) return h;
  return { pasado: h.pasado.slice(0, -1), actual: h.pasado[h.pasado.length - 1], futuro: [h.actual, ...h.futuro] };
}
export function rehacer<T>(h: Historial<T>): Historial<T> {
  if (!h.futuro.length) return h;
  return { pasado: [...h.pasado, h.actual], actual: h.futuro[0], futuro: h.futuro.slice(1) };
}
/** Después de guardar: lo guardado es el nuevo punto de partida, pero se puede seguir deshaciendo lo anterior. */
export const conActual = <T,>(h: Historial<T>, actual: T): Historial<T> => ({ ...h, actual });

// ── Clases de la semana ─────────────────────────────────────────────

export type DiaDeClases = { dia: string; etiqueta: string; clases: { hora: string; actividad: string; sede: string }[] };

const NOMBRE_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const NOMBRE_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "Hoy", "Mañana" o "Lunes 11 de noviembre", para un día YYYY-MM-DD, contra el día de hoy `hoy` (YYYY-MM-DD) en la zona del gimnasio. */
export function etiquetaDia(dia: string, hoy: string): string {
  const f = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  const dif = Math.round((f(dia) - f(hoy)) / 86_400_000);
  if (dif === 0) return "Hoy";
  if (dif === 1) return "Mañana";
  const d = new Date(f(dia));
  const n = NOMBRE_DIA[d.getUTCDay()];
  return `${n[0].toUpperCase()}${n.slice(1)} ${d.getUTCDate()} de ${NOMBRE_MES[d.getUTCMonth()]}`;
}

/** Hoy (YYYY-MM-DD) en una zona horaria. */
export function hoyEnZona(zona: string, ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
}

/** Las clases agrupadas por día, en orden, cada día con sus clases por hora. Sin clases: lista vacía (el bloque no se muestra). */
export function agruparClases(clases: readonly ClaseSemana[], ahora = new Date()): DiaDeClases[] {
  const dias = new Map<string, DiaDeClases>();
  for (const c of [...clases].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
    let d = dias.get(c.dia);
    if (!d) { d = { dia: c.dia, etiqueta: etiquetaDia(c.dia, hoyEnZona(c.zona, ahora)), clases: [] }; dias.set(c.dia, d); }
    d.clases.push({ hora: c.hora, actividad: c.actividad, sede: c.sede });
  }
  return [...dias.values()];
}
