/**
 * CUIT argentino: 11 cifras, prefijo de tipo de persona y dígito verificador (módulo 11).
 * La misma regla vive en la base (`privado.cuit_valido`): la pantalla avisa antes de pedir, la base decide.
 */
const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
const PREFIJOS = ["20", "23", "24", "27", "30", "33", "34"];

/** Solo las cifras: acepta "30-71234567-8", "30 71234567 8" o "30712345678". */
export const cuitSoloCifras = (texto: string) => texto.replace(/\D/g, "");

export function cuitValido(texto: string): boolean {
  const c = cuitSoloCifras(texto);
  if (!/^\d{11}$/.test(c) || !PREFIJOS.includes(c.slice(0, 2))) return false;
  const suma = PESOS.reduce((a, p, i) => a + p * Number(c[i]), 0);
  const resto = 11 - (suma % 11);
  const digito = resto === 11 ? 0 : resto;
  return digito !== 10 && digito === Number(c[10]);
}

/** "30-71234567-8" (o lo que haya, si todavía no tiene 11 cifras). */
export function cuitConGuiones(texto: string): string {
  const c = cuitSoloCifras(texto);
  return c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : texto;
}

/** El texto que se le muestra a quien carga el CUIT; vacío si está bien o si no escribió nada. */
export function errorDeCuit(texto: string): string {
  if (!texto.trim()) return "";
  const c = cuitSoloCifras(texto);
  if (c.length !== 11) return "El CUIT tiene 11 cifras.";
  if (!PREFIJOS.includes(c.slice(0, 2))) return "El CUIT tiene que empezar con 20, 23, 24, 27, 30, 33 o 34.";
  if (!cuitValido(c)) return "El dígito verificador no coincide: revisá el número.";
  return "";
}
