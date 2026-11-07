import { describe, expect, it } from "vitest";
import type { PagoMP } from "@/lib/mercadopago";
import { claveEvento, procesarPagoMP, revisarPagosMP, type ClienteBase } from "./mp-procesar";

const REF = "11111111-2222-4333-8444-555555555555";
const pago = (extra: Partial<PagoMP> = {}): PagoMP => ({ id: 880001, status: "approved", external_reference: REF, transaction_amount: 25000, currency_id: "ARS", date_last_updated: "2026-11-14T12:00:00Z", ...extra });

/** Una base de mentira: anota las llamadas y contesta lo que se le pida. */
function base(respuestas: Record<string, unknown> = {}) {
  const llamadas: { nombre: string; args: Record<string, unknown> }[] = [];
  const db: ClienteBase = {
    rpc: async (nombre, args = {}) => {
      llamadas.push({ nombre, args });
      const r = respuestas[nombre];
      if (r instanceof Error) return { data: null, error: { message: r.message } };
      return { data: typeof r === "function" ? (r as (a: unknown) => unknown)(args) : r ?? null, error: null };
    },
  };
  return { db, llamadas };
}

describe("claveEvento", () => {
  it("el mismo pago en otro estado es otro evento (el contracargo no queda tapado por el approved)", () => {
    expect(claveEvento(pago())).toBe("880001:approved");
    expect(claveEvento(pago({ status: "charged_back" }))).toBe("880001:charged_back");
    expect(claveEvento(pago({ transaction_amount_refunded: 500 }))).toBe("880001:approved:dev500");
  });
});

describe("procesarPagoMP", () => {
  it("un contracargo registra su evento, manda la fecha del estado a la base y lo cierra", async () => {
    const { db, llamadas } = base({ registrar_evento_webhook: { evento_id: "e1", procesado: false }, acreditar_pago_mp: "devuelto" });
    const r = await procesarPagoMP(db, "g1", pago({ status: "charged_back" }));
    expect(r).toEqual({ resultado: "devuelto" });
    expect(llamadas.map((l) => l.nombre)).toEqual(["registrar_evento_webhook", "acreditar_pago_mp", "cerrar_evento_webhook"]);
    expect(llamadas[0].args.p_id_externo).toBe("880001:charged_back");
    expect(llamadas[1].args).toMatchObject({ p_estado: "charged_back", p_fecha: "2026-11-14T12:00:00Z", p_mp_pago_id: "880001" });
  });

  it("un evento ya procesado no vuelve a tocar la base", async () => {
    const { db, llamadas } = base({ registrar_evento_webhook: { evento_id: "e1", procesado: true } });
    expect(await procesarPagoMP(db, "g1", pago())).toEqual({ resultado: "ya_procesado", ya: true });
    expect(llamadas.map((l) => l.nombre)).toEqual(["registrar_evento_webhook"]);
  });

  it("pendiente o en proceso: el evento queda abierto para el próximo aviso", async () => {
    const { db, llamadas } = base({ registrar_evento_webhook: { evento_id: "e1", procesado: false }, acreditar_pago_mp: "sin_cambios" });
    await procesarPagoMP(db, "g1", pago({ status: "in_process" }));
    expect(llamadas.some((l) => l.nombre === "cerrar_evento_webhook")).toBe(false);
  });

  it("si la base falla, el error queda anotado en el evento y se relanza (MercadoPago vuelve a avisar)", async () => {
    const { db, llamadas } = base({ registrar_evento_webhook: { evento_id: "e1", procesado: false }, acreditar_pago_mp: new Error("MercadoPago cobró 1 y el pago era de 2") });
    await expect(procesarPagoMP(db, "g1", pago())).rejects.toThrow(/cobró/);
    expect(llamadas.at(-1)).toMatchObject({ nombre: "cerrar_evento_webhook", args: { p_evento_id: "e1", p_error: expect.stringMatching(/cobró/) } });
  });

  it("sin nuestra referencia o con otra moneda no toca nada", async () => {
    const { db, llamadas } = base();
    await expect(procesarPagoMP(db, "g1", pago({ external_reference: null }))).rejects.toThrow(/referencia/);
    await expect(procesarPagoMP(db, "g1", pago({ currency_id: "USD" }))).rejects.toThrow(/Moneda/);
    expect(llamadas).toHaveLength(0);
  });
});

describe("revisarPagosMP (la reconsulta sin cron)", () => {
  const candidatos = [
    { pago_id: REF, mp_pago_id: null, estado: "pendiente" },
    { pago_id: "aaaaaaaa-2222-4333-8444-555555555555", mp_pago_id: "880002", estado: "aprobado" },
    { pago_id: "bbbbbbbb-2222-4333-8444-555555555555", mp_pago_id: "880003", estado: "aprobado" },
  ];

  it("consulta cada candidato, aplica lo que cambió y sigue aunque uno falle", async () => {
    const { db, llamadas } = base({
      revisar_pagos_mp: candidatos,
      registrar_evento_webhook: { evento_id: "e", procesado: false },
      acreditar_pago_mp: (a: unknown) => ((a as { p_estado: string }).p_estado === "approved" ? "acreditado" : "devuelto"),
    });
    const consultadas: unknown[] = [];
    const r = await revisarPagosMP(db, "g1", async (c) => {
      consultadas.push(c);
      if (c.mpPagoId === "880003") throw new Error("MercadoPago respondió 500");
      if (c.mpPagoId === null) return null;   // el socio abrió el checkout y nunca pagó
      return pago({ id: 880002, status: "charged_back", external_reference: c.pagoId });
    });
    expect(consultadas).toHaveLength(3);
    expect(r).toMatchObject({ revisados: 3, sinPago: 1 });
    expect(r.cambios).toEqual([{ pago_id: candidatos[1].pago_id, resultado: "devuelto" }]);
    expect(r.errores).toEqual([{ pago_id: candidatos[2].pago_id, error: "MercadoPago respondió 500" }]);
    expect(llamadas[0]).toMatchObject({ nombre: "revisar_pagos_mp", args: { p_gimnasio_id: "g1", p_pago_id: null } });
  });

  it("lo que ya estaba al día no cuenta como cambio", async () => {
    const { db } = base({ revisar_pagos_mp: [candidatos[1]], registrar_evento_webhook: { evento_id: "e", procesado: true } });
    const r = await revisarPagosMP(db, "g1", async (c) => pago({ id: 880002, external_reference: c.pagoId }));
    expect(r.cambios).toEqual([]);
    expect(r.errores).toEqual([]);
  });

  it("para un solo pago (la pantalla del socio) se lo pide a la base por su ID", async () => {
    const { db, llamadas } = base({ revisar_pagos_mp: [] });
    const r = await revisarPagosMP(db, "g1", async () => null, { pagoId: REF });
    expect(r.revisados).toBe(0);
    expect(llamadas[0].args).toEqual({ p_gimnasio_id: "g1", p_pago_id: REF });
  });

  it("si la base no deja revisar, el error sale (no es un cero)", async () => {
    const { db } = base({ revisar_pagos_mp: new Error("permission denied") });
    await expect(revisarPagosMP(db, "g1", async () => null)).rejects.toThrow(/permission denied/);
  });
});
