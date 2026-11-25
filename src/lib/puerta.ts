// La palabra grande del resultado de la puerta (Pista Semáforo). Solo redacta lo que dijo la base: no calcula el acceso.

/** Cierre para vender (25/11): "Vence mañana", "Vence en 3 días" o "Vence hoy" cuando la base dijo amarillo por vencer. Sale del texto que
 *  arma calcular_acceso (motivo por_vencer: "Vence hoy", "Vence mañana", "Vence en N días (…)"); no se cuenta ningún día acá. */
export function venceDe(color: string, texto?: string | null): string | null {
  if (color !== "amarillo" || !texto) return null;
  const m = /^Vence (hoy|mañana|en \d+ días)/.exec(texto);
  return m ? `Vence ${m[1]}` : null;
}

/** La palabra grande: PASA / NO PASA, y con amarillo por vencer, PASA · VENCE MAÑANA. */
export function palabraPuerta(puede: boolean, color: string, texto?: string | null): string {
  if (!puede) return "NO PASA";
  const v = venceDe(color, texto);
  return v ? `PASA · ${v.toUpperCase()}` : "PASA";
}
