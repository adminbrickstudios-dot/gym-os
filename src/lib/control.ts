// VD-10 · Control: los tipos de la línea de tiempo y cómo se cuenta cada uno en castellano.
// Función pura (sin base): la comparten la pantalla, el CSV y las pruebas.
import { formatearPesos } from "@/lib/formato";

export const TIPOS_CONTROL = ["cobro", "anulacion", "descuento", "otro_dia", "dejado_pasar", "caja", "precio", "configuracion", "entrada_anulada", "invitado", "prestamo"] as const;
export type TipoControl = (typeof TIPOS_CONTROL)[number];

export const META_TIPO: Record<TipoControl, { emoji: string; etiqueta: string }> = {
  cobro: { emoji: "plata", etiqueta: "Cobros" },
  anulacion: { emoji: "deshacer", etiqueta: "Anulaciones" },
  descuento: { emoji: "etiqueta", etiqueta: "Descuentos" },
  otro_dia: { emoji: "calendario", etiqueta: "Cobré otro día" },
  dejado_pasar: { emoji: "puerta", etiqueta: "Dejados pasar" },
  caja: { emoji: "plata", etiqueta: "Cajas" },
  precio: { emoji: "plata", etiqueta: "Precios" },
  configuracion: { emoji: "ajustes", etiqueta: "Configuración" },
  entrada_anulada: { emoji: "prohibido", etiqueta: "Entradas anuladas" },
  invitado: { emoji: "ticket", etiqueta: "Invitados" },
  prestamo: { emoji: "", etiqueta: "Anti-préstamo" },
};

export type ItemControl = {
  tipo: TipoControl; clave: string; en: string; quien_id: string | null; quien: string | null;
  monto: number | string | null; socio_id: string | null; socio: string | null; detalle: string | null;
  extra: Record<string, unknown>;
};
export type PaginaControl = { items: ItemControl[]; siguiente: string | null };

const MEDIO: Record<string, string> = { efectivo: "efectivo", transferencia: "transferencia", debito: "débito", credito: "crédito", mercadopago: "Mercado Pago", cuenta_corriente: "a cuenta" };
const VIA: Record<string, string> = { recepcion: "recepción", qr_socio: "el QR", qr_pared: "el QR de la pared", kiosco: "la tablet", nfc: "el llavero", molinete: "el molinete" };
const pesos = (n: unknown) => formatearPesos(n as number | string);
const fechaCorta = (iso: unknown, zona: string) => (typeof iso === "string" ? new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit" }).format(new Date(iso)) : "");
const diaSolo = (d: unknown) => (typeof d === "string" ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "");

/** La frase de cada movimiento: qué pasó, con la plata y la persona. */
export function tituloControl(i: ItemControl, zona: string): string {
  const quien = i.quien ?? "Alguien";
  const socio = i.socio ? ` a ${i.socio}` : "";
  const x = i.extra;
  switch (i.tipo) {
    case "cobro": return `${quien} cobró ${pesos(i.monto)}${socio}${x.anulada ? " (después se anuló)" : ""}`;
    case "anulacion": return `${quien} anuló una venta de ${pesos(i.monto)}${i.socio ? ` de ${i.socio}` : ""}`;
    case "descuento": return `${quien} hizo un descuento de ${pesos(i.monto)}${x.porcentaje != null ? ` (${x.porcentaje} %)` : ""}${socio}`;
    case "otro_dia": return `${quien} cargó un cobro con fecha del ${fechaCorta(x.cobrado_el, zona)}: ${pesos(i.monto)}${socio}`;
    case "dejado_pasar": return `${quien} dejó pasar a ${i.socio ?? "un socio"}${x.promete_el ? `, paga el ${diaSolo(x.promete_el)}` : ""}`;
    case "caja": {
      const e = x.evento;
      if (e === "abrio") return `${quien} abrió la ${i.detalle ?? "caja"} con ${pesos(i.monto)}`;
      if (e === "cerro") {
        const d = Number(i.monto ?? 0);
        return `${quien} cerró la ${(i.detalle ?? "caja").split(":")[0]} ${d === 0 ? "justa" : `con ${pesos(Math.abs(d))} ${d > 0 ? "de más" : "de menos"}`}`;
      }
      return `La ${i.detalle ?? "caja"} quedó sin contar${x.revisada ? " (ya revisada)" : ""}`;
    }
    case "precio": return `${quien} puso ${pesos(i.monto)} a ${i.detalle ?? "un precio"}`;
    case "configuracion": return `${quien} cambió ${i.detalle ?? "la configuración"}`;
    case "entrada_anulada": return `${quien} anuló la entrada de ${i.socio ?? "un socio"}`;
    case "invitado": return `${i.socio ?? "Un socio"} invitó a ${i.detalle ?? "alguien"}${i.quien ? ` (lo cargó ${i.quien})` : x.desde_la_app ? " (desde la app)" : ""}`;
    case "prestamo": return `${i.socio ?? "Un socio"} volvió a entrar por otra vía`;
  }
}

/** La segunda línea: el motivo, el medio, la vía… lo que ayuda a entender. */
export function detalleControl(i: ItemControl): string | null {
  const x = i.extra;
  switch (i.tipo) {
    case "cobro": return [i.detalle, typeof x.medios === "string" ? x.medios.split(", ").map((m) => MEDIO[m] ?? m).join(" + ") : null].filter(Boolean).join(" · ") || null;
    case "anulacion": return [i.detalle ? `Motivo: ${i.detalle}` : null, x.pidio ? `pidió ${x.pidio}` : null, x.aprobo ? `aprobó ${x.aprobo}` : null].filter(Boolean).join(" · ") || null;
    case "descuento": case "dejado_pasar": case "entrada_anulada": return i.detalle;
    case "otro_dia": return i.detalle ? `Motivo: ${i.detalle}` : null;
    case "caja": return i.extra.evento === "cerro" && i.detalle?.includes(": ") ? i.detalle.split(": ").slice(1).join(": ") : null;
    case "precio": return x.antes != null ? `Antes ${pesos(x.antes)}` : null;
    case "configuracion": return x.antes !== undefined || x.despues !== undefined ? `${valor(x.antes)} → ${valor(x.despues)}` : null;
    case "invitado": return x.anulado ? "Invitación anulada" : x.entro ? "Ya entró" : null;
    case "prestamo": return `${i.detalle ?? ""}${x.via_anterior ? ` (antes por ${VIA[String(x.via_anterior)] ?? x.via_anterior}, ahora por ${VIA[String(x.via_nueva)] ?? x.via_nueva})` : ""}`.trim() || null;
  }
}

function valor(v: unknown): string {
  if (v == null) return "—";
  const t = typeof v === "string" ? v : JSON.stringify(v);
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
}

/** A dónde lleva tocar el movimiento (la ficha del socio o la pantalla del tema). */
export function enlaceControl(i: ItemControl): string | null {
  if (i.socio_id && ["cobro", "anulacion", "descuento", "otro_dia", "dejado_pasar", "entrada_anulada", "prestamo", "invitado"].includes(i.tipo)) return `/panel/socios/${i.socio_id}`;
  if (i.tipo === "caja") return "/panel/caja/historial";
  if (i.tipo === "precio") return "/panel/planes";
  if (i.tipo === "configuracion") return "/panel/configuracion";
  return null;
}

/** Una fila del CSV: la fecha en la hora del gimnasio y la plata con coma. */
export function filaCsv(i: ItemControl, zona: string): (string | number | null)[] {
  const fecha = new Intl.DateTimeFormat("es-AR", { timeZone: zona, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(i.en));
  return [fecha, META_TIPO[i.tipo]?.etiqueta ?? i.tipo, i.quien ?? "", i.socio ?? "", i.monto == null ? "" : Number(i.monto).toFixed(2).replace(".", ","), tituloControl(i, zona), detalleControl(i) ?? ""];
}
export const TITULOS_CSV = ["Fecha", "Tipo", "Quién", "Socio", "Monto", "Qué pasó", "Detalle"];

/** Tope de filas por pedido de exportación. */
export const TOPE_CSV = 5000;
