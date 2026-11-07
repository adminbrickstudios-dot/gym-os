// Texto del cierre de caja para mandar por WhatsApp (CAJ-2). Solo arma el
// texto con lo que ya calculó la base (resumen_turno); no hace cuentas propias.
import { formatearPesos } from "./formato";

export const MEDIO: Record<string, string> = { efectivo: "Efectivo", transferencia: "Transferencia", debito: "Débito", credito: "Crédito", mercadopago: "MercadoPago", cuenta_corriente: "A cuenta" };

export type CierreParaCompartir = {
  caja: string; cuando: string; abrio?: string | null; cerro?: string | null;
  monto_inicial: number; efectivo: number; ingresos: number; retiros: number; esperado: number; contado: number | null; diferencia: number | null;
  otros_medios?: Record<string, number>; nota?: string | null;
};

export function textoCierre(c: CierreParaCompartir): string {
  const dif = c.diferencia ?? 0;
  const otros = Object.entries(c.otros_medios ?? {});
  return [
    `🔒 Cierre de caja · ${c.caja} · ${c.cuando}`,
    c.abrio || c.cerro ? `Abrió ${c.abrio ?? "—"}${c.cerro ? ` · cerró ${c.cerro}` : ""}` : null,
    `Inicial ${formatearPesos(c.monto_inicial)} · Efectivo cobrado ${formatearPesos(c.efectivo)}${c.ingresos ? ` · Entró ${formatearPesos(c.ingresos)}` : ""}${c.retiros ? ` · Salió ${formatearPesos(c.retiros)}` : ""}`,
    `Tenía que haber ${formatearPesos(c.esperado)} · Contado ${c.contado == null ? "—" : formatearPesos(c.contado)}`,
    c.contado == null ? null : dif === 0 ? "✅ Caja justa" : dif > 0 ? `➕ Sobraron ${formatearPesos(dif)}` : `⚠️ Faltaron ${formatearPesos(-dif)}`,
    otros.length ? `Además: ${otros.map(([m, v]) => `${MEDIO[m] ?? m} ${formatearPesos(v)}`).join(" · ")}` : null,
    c.nota ? `Nota: ${c.nota}` : null,
  ].filter(Boolean).join("\n");
}

export const DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100] as const;

/** VD-9: el total de la calculadora de billetes y el detalle para guardar ({"1000": 3, "otros": 150}). La base lo vuelve a sumar. */
export function sumarBilletes(cantidades: Record<string, number>, otros: number): { total: number; detalle: Record<string, number> } {
  const detalle: Record<string, number> = {};
  let total = 0;
  for (const d of DENOMINACIONES) {
    const n = cantidades[String(d)] ?? 0;
    if (n > 0) { detalle[String(d)] = n; total += d * n; }
  }
  if (otros > 0) { detalle.otros = otros; total += otros; }
  return { total: Math.round(total * 100) / 100, detalle };
}

/** VD-9: "SOBRA $x" / "FALTA $x" / "JUSTA" (null si todavía no se contó). Solo da formato a la diferencia que calculó la base. */
export function veredictoCaja(diferencia: number | null): { clave: "justa" | "sobra" | "falta" | "sin_contar"; texto: string; monto: number } {
  if (diferencia == null) return { clave: "sin_contar", texto: "SIN CONTAR", monto: 0 };
  if (diferencia === 0) return { clave: "justa", texto: "CAJA JUSTA", monto: 0 };
  return diferencia > 0 ? { clave: "sobra", texto: `SOBRAN ${formatearPesos(diferencia)}`, monto: diferencia } : { clave: "falta", texto: `FALTAN ${formatearPesos(-diferencia)}`, monto: -diferencia };
}

export type DiaParaCompartir = {
  sede: string; dia: string; contados: number; esperado_contado: number; contado: number; diferencia: number; sin_contar: number; esperado_sin_contar: number; abiertos: number;
  ventas: { cantidad: number; total: number }; por_medio: { medio: string; total: number }[]; retiros: number; anuladas: number; dejados_pasar: number;
};

/** VD-9: el cierre del día (Z) escrito para mandar por WhatsApp. */
export function textoDia(d: DiaParaCompartir): string {
  const v = veredictoCaja(d.contados > 0 ? d.diferencia : null);
  return [
    `📋 Cierre del día · ${d.sede} · ${d.dia}`,
    `Vendido ${formatearPesos(d.ventas.total)} en ${d.ventas.cantidad} ${d.ventas.cantidad === 1 ? "venta" : "ventas"}${d.anuladas ? ` (${d.anuladas} anulada${d.anuladas === 1 ? "" : "s"})` : ""}`,
    d.por_medio.length ? `Por medio: ${d.por_medio.map((m) => `${MEDIO[m.medio] ?? m.medio} ${formatearPesos(m.total)}`).join(" · ")}` : null,
    d.retiros ? `Retiros ${formatearPesos(d.retiros)}` : null,
    `Tenía que haber ${formatearPesos(d.esperado_contado)} · Contado ${formatearPesos(d.contado)}`,
    v.clave === "sin_contar" ? null : v.clave === "justa" ? "✅ Caja justa" : v.clave === "sobra" ? `➕ Sobraron ${formatearPesos(v.monto)}` : `⚠️ Faltaron ${formatearPesos(v.monto)}`,
    d.sin_contar ? `🧾 ${d.sin_contar} ${d.sin_contar === 1 ? "caja quedó" : "cajas quedaron"} sin contar (tenían que tener ${formatearPesos(d.esperado_sin_contar)})` : null,
    d.abiertos ? `🔓 ${d.abiertos} ${d.abiertos === 1 ? "turno sigue abierto" : "turnos siguen abiertos"}` : null,
    d.dejados_pasar ? `Dejaron pasar sin pagar: ${d.dejados_pasar}` : null,
  ].filter(Boolean).join("\n");
}

/** Link de WhatsApp sin destinatario: se elige el chat (el del dueño). */
export const linkCompartir = (texto: string) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
