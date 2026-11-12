// Importar socios: leer un CSV y adivinar qué columna es qué. Funciones puras
// (el Excel lo lee read-excel-file en el navegador; las filas llegan iguales).

export type CampoDato = "nombre" | "apellido" | "dni" | "telefono" | "email" | "nacimiento" | "plan" | "alta" | "vence";
// C10 · Pagos pasados: hasta 3 por socio, cada uno con su fecha, monto y medio (en columnas aparte). Cada grupo arma un pago.
export const CANTIDAD_PAGOS = 3;
export type CampoPago = `pago${1 | 2 | 3}_${"fecha" | "monto" | "medio"}`;
export type Campo = CampoDato | CampoPago;
export type PagoImportacion = { fecha: string; monto: string; medio: string };
export type FilaImportacion = Partial<Record<CampoDato, string>> & { pagos?: PagoImportacion[] };
const ETIQUETA_PAGO = { fecha: "fecha", monto: "monto", medio: "medio de pago" } as const;
const CAMPOS_PAGO: { campo: Campo; etiqueta: string }[] = ([1, 2, 3] as const).flatMap((n) =>
  (["fecha", "monto", "medio"] as const).map((k) => ({ campo: `pago${n}_${k}` as Campo, etiqueta: `Pago ${n}: ${ETIQUETA_PAGO[k]}` })));
export const CAMPOS: { campo: Campo; etiqueta: string }[] = [
  { campo: "nombre", etiqueta: "Nombre (o nombre y apellido)" }, { campo: "apellido", etiqueta: "Apellido" },
  { campo: "dni", etiqueta: "DNI" }, { campo: "telefono", etiqueta: "Celular" }, { campo: "email", etiqueta: "Mail" },
  { campo: "nacimiento", etiqueta: "Fecha de nacimiento" }, { campo: "plan", etiqueta: "Plan" }, { campo: "alta", etiqueta: "Fecha de alta" }, { campo: "vence", etiqueta: "Pagó hasta" },
  ...CAMPOS_PAGO,
];

/** Lee un CSV (coma, punto y coma o tabulación; comillas dobles) en filas. */
export function leerCsv(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, "");
  const primera = limpio.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", "\t", ","].map((s) => [s, primera.split(s).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const filas: string[][] = [];
  let fila: string[] = [], campo = "", comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && limpio[i + 1] === "\n") i++;
      fila.push(campo); campo = "";
      if (fila.some((x) => x.trim())) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo);
  if (fila.some((x) => x.trim())) filas.push(fila);
  return filas;
}

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
// El orden importa: la primera pista que coincide gana, y cada campo se usa una sola vez.
// Los pagos primero: "Fecha de pago 2" no tiene que caer en "alta" ni en "pagó hasta". El pago 1 también se reconoce sin número.
const PISTAS_PAGO: [Campo, RegExp][] = ([1, 2, 3] as const).flatMap((n): [Campo, RegExp][] => {
  const num = n === 1 ? "(?:1\\b|^(?!.*\\d))" : `${n}\\b`;
  return [
    [`pago${n}_fecha` as Campo, new RegExp(`^(?=.*${num})(?=.*(fecha.*pag|pag.*fecha|fecha.*cobr|cobr.*fecha))`)],
    [`pago${n}_monto` as Campo, new RegExp(`^(?=.*${num})(?=.*(monto|importe))`)],
    [`pago${n}_medio` as Campo, new RegExp(`^(?=.*${num})(?=.*(medio|forma.*pag))`)],
  ];
});
const PISTAS: [Campo, RegExp][] = [
  ...PISTAS_PAGO,
  ["vence", /venc|hasta|pagado|cubierto/], ["alta", /\balta\b|ingreso|inscrip|incorpor|desde/],
  ["nacimiento", /nac|cumple/], ["nombre", /nombre|socio|cliente/], ["apellido", /apellido/],
  ["dni", /dni|documento|\bdoc\b/], ["telefono", /cel|tel|whats|movil/], ["email", /mail|correo/],
  ["plan", /plan|membres|abono|cuota/],
];

/** Adivina el campo de cada columna por su título. Un campo se usa una sola vez. */
export function adivinarColumnas(titulos: string[]): (Campo | null)[] {
  const usados = new Set<Campo>();
  return titulos.map((t) => {
    const x = sinAcentos(t);
    const p = PISTAS.find(([c, re]) => !usados.has(c) && re.test(x));
    if (!p) return null;
    usados.add(p[0]);
    return p[0];
  });
}

/** Una celda (texto, número o fecha del Excel) como texto para la base: fechas como AAAA-MM-DD. */
export function celda(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  return String(v).trim();
}

/** Las filas con cada columna en su campo (lo que manda la pantalla a la base). Los pagos de cada fila van en una lista aparte. */
export function armarFilas(datos: unknown[][], mapa: (Campo | null)[]): FilaImportacion[] {
  return datos.map((fila) => {
    const r: Partial<Record<Campo, string>> = {};
    mapa.forEach((c, i) => { if (c) r[c] = celda(fila[i]); });
    const pagos: PagoImportacion[] = [];
    for (let n = 1; n <= CANTIDAD_PAGOS; n++) {
      const p = { fecha: r[`pago${n}_fecha` as CampoPago] ?? "", monto: r[`pago${n}_monto` as CampoPago] ?? "", medio: r[`pago${n}_medio` as CampoPago] ?? "" };
      if (p.fecha || p.monto || p.medio) pagos.push(p);   // un grupo a medias se manda igual: la base dice qué falta
    }
    const datosFila: FilaImportacion = {};
    for (const [k, v] of Object.entries(r)) if (!/^pago\d_/.test(k)) (datosFila as Record<string, string>)[k] = v as string;
    if (pagos.length) datosFila.pagos = pagos;
    return datosFila;
  }).filter((r) => r.pagos?.length || Object.entries(r).some(([k, v]) => k !== "pagos" && v));
}
