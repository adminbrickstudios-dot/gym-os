// VD-41: lo que comparten Resultado y Gastos. Todo el cálculo (fijos del mes,
// ganancia, desvío) lo hace la base en ganancia_mes; acá solo nombres y formas.

export const CATEGORIAS_GASTO: [string, string][] = [
  ["alquiler", "Alquiler"], ["sueldos", "Sueldos"], ["servicios", "Servicios"],
  ["mantenimiento", "Mantenimiento"], ["proveedores", "Proveedores"], ["otros", "Otros"],
];
export const NOMBRE_CATEGORIA: Record<string, string> = Object.fromEntries(CATEGORIAS_GASTO);

export type GananciaMes = {
  mes: string; en_curso: boolean; es_dueno: boolean; encargado_ve_gastos: boolean;
  ingresos: number; total_unicos: number; total_fijos: number; total: number; ganancia: number; presupuesto_total: number;
  gastos: { gasto_id: string; fecha: string; categoria: string; detalle: string | null; monto: number; comprobante: boolean; por: string | null }[];
  fijos: { fijo_id: string; categoria: string; detalle: string | null; monto: number; desde: string; hasta: string | null }[];
  por_categoria: { categoria: string; gastado: number; presupuesto: number | null; desvio: number | null }[];
  hay_gastos_mes_anterior: boolean;
};

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** "2026-03-01" → "marzo 2026" */
export const nombreMes = (d: string) => `${MESES[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
/** "2026-03-15" → "15/03" */
export const diaCorto = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
