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

/** Link de WhatsApp sin destinatario: se elige el chat (el del dueño). */
export const linkCompartir = (texto: string) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
