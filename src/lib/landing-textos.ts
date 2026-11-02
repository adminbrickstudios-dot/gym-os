// Textos derivados de los datos de la landing. Funciones puras, con pruebas.
import { formatearPesos } from "@/lib/formato";
import type { PlanPublico } from "@/lib/landing";

/** Link de WhatsApp con mensaje armado. null si el número no es válido. */
export function linkWhatsapp(telefono: string | null | undefined, mensaje: string): string | null {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  if (digitos.length < 8) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`;
}

/** "por mes", "por 3 meses", "por día", "10 clases" */
export function unidadPlan(p: PlanPublico): string {
  if (p.tipo === "pase_diario") return "por día";
  if (p.tipo === "pack") return p.cantidad_clases ? `${p.cantidad_clases} clases` : "pack";
  const m = p.duracion_meses ?? 1;
  return m === 1 ? "por mes" : `por ${m} meses`;
}

/** Condiciones del plan, en lenguaje de mostrador. */
export function condicionesPlan(p: PlanPublico): string[] {
  const c: string[] = [];
  if (p.hora_desde && p.hora_hasta) c.push(`De ${p.hora_desde.replace(/^0/, "")} a ${p.hora_hasta.replace(/^0/, "")}`);
  if (p.max_ingresos_semana) c.push(`${p.max_ingresos_semana} ${p.max_ingresos_semana === 1 ? "vez" : "veces"} por semana`);
  return c;
}

const MEDIOS: Record<string, string> = {
  efectivo: "en efectivo",
  transferencia: "por transferencia",
  mercadopago: "con MercadoPago",
  debito: "con débito",
  credito: "con crédito",
};

/** "$22.000 pagando en efectivo antes del día 10". Solo las que son más baratas que el precio de lista. */
export function variantesPlan(p: PlanPublico): string[] {
  const base = Number(p.precio ?? Infinity);
  return (p.variantes ?? [])
    .filter((v) => Number(v.monto) < base)
    .map((v) => {
      const partes = [formatearPesos(v.monto), "pagando"];
      if (v.medio_pago) partes.push(MEDIOS[v.medio_pago] ?? v.medio_pago);
      if (v.pago_hasta_dia) partes.push(`hasta el día ${v.pago_hasta_dia}`);
      return partes.join(" ");
    });
}

/** Iniciales para el avatar sin foto: "Profe Demo Uno" → "PD" */
export function iniciales(nombre: string): string {
  return nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export { textoSobre } from "@/lib/marca";
