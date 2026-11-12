import { describe, expect, it } from "vitest";
import type { ClienteBase } from "@/lib/mp-procesar";
import { normalizarCobroDebito, procesarAdhesionDebito, procesarCobroDebito, type CobroDebitoMP } from "./mp-debito-procesar";

const cobro = (extra: Partial<CobroDebitoMP> = {}): CobroDebitoMP => ({ pagoId: "770001", suscripcionId: "sus-1", monto: 25000, estado: "approved", fecha: "2026-11-14T12:00:00Z", ...extra });

function base(respuestas: Record<string, unknown> = {}) {
  const llamadas: { nombre: string; args: Record<string, unknown> }[] = [];
  const db: ClienteBase = {
    rpc: async (nombre, args = {}) => {
      llamadas.push({ nombre, args });
      const r = respuestas[nombre];
      if (r instanceof Error) return { data: null, error: { message: r.message } };
      return { data: r ?? null, error: null };
    },
  };
  return { db, llamadas };
}

describe("normalizarCobroDebito (N1)", () => {
  it("toma el pago anidado y llama approved a lo procesado", () => {
    expect(normalizarCobroDebito({ id: 55, preapproval_id: "sus-1", status: "processed", transaction_amount: 25000, payment: { id: 880, status: "approved" } }))
      .toMatchObject({ pagoId: "880", suscripcionId: "sus-1", estado: "approved", monto: 25000 });
    expect(normalizarCobroDebito({ id: 55, preapproval_id: "sus-1", status: "processed", transaction_amount: 100 })).toMatchObject({ pagoId: "55", estado: "approved" });
    expect(normalizarCobroDebito({ id: 55, preapproval_id: "sus-1", status: "recycling", transaction_amount: 100 }).estado).toBe("in_process");
  });
  it("rechaza lo que no se puede acreditar: sin suscripción, sin monto o en otra moneda", () => {
    expect(() => normalizarCobroDebito({ id: 1, transaction_amount: 10, status: "processed" })).toThrow(/suscripción/);
    expect(() => normalizarCobroDebito({ id: 1, preapproval_id: "s", status: "processed" })).toThrow(/monto/);
    expect(() => normalizarCobroDebito({ id: 1, preapproval_id: "s", transaction_amount: 10, currency_id: "USD", status: "processed" })).toThrow(/Moneda/);
  });
});

describe("procesarCobroDebito (N1)", () => {
  it("registra el evento por ID de pago y estado, acredita en la base y lo cierra", async () => {
    const { db, llamadas } = base({ registrar_evento_webhook: { evento_id: "e1", procesado: false }, acreditar_cobro_debito: "acreditado" });
    expect(await procesarCobroDebito(db, "g1", cobro())).toEqual({ resultado: "acreditado" });
    expect(llamadas.map((l) => l.nombre)).toEqual(["registrar_evento_webhook", "acreditar_cobro_debito", "cerrar_evento_webhook"]);
    expect(llamadas[0].args).toMatchObject({ p_id_externo: "770001:approved", p_tipo: "debito_cobro" });
    expect(llamadas[1].args).toMatchObject({ p_mp_suscripcion_id: "sus-1", p_mp_pago_id: "770001", p_monto: 25000, p_estado: "approved" });
  });
  it("el mismo aviso otra vez (evento ya procesado) no toca la base", async () => {
    const { db, llamadas } = base({ registrar_evento_webhook: { evento_id: "e1", procesado: true } });
    expect(await procesarCobroDebito(db, "g1", cobro())).toEqual({ resultado: "ya_procesado", ya: true });
    expect(llamadas.map((l) => l.nombre)).toEqual(["registrar_evento_webhook"]);
  });
  it("si la base rechaza (monto distinto), el evento queda cerrado con el error y se vuelve a tirar", async () => {
    const { db, llamadas } = base({ registrar_evento_webhook: { evento_id: "e1", procesado: false }, acreditar_cobro_debito: new Error("MercadoPago cobró 20000 y la adhesión era de 25000: no se acredita") });
    await expect(procesarCobroDebito(db, "g1", cobro({ monto: 20000 }))).rejects.toThrow(/no se acredita/);
    expect(llamadas.at(-1)).toMatchObject({ nombre: "cerrar_evento_webhook", args: { p_error: expect.stringContaining("no se acredita") } });
  });
  it("pendiente: el evento queda abierto para el próximo aviso", async () => {
    const { db, llamadas } = base({ registrar_evento_webhook: { evento_id: "e1", procesado: false }, acreditar_cobro_debito: "sin_cambios" });
    await procesarCobroDebito(db, "g1", cobro({ estado: "in_process" }));
    expect(llamadas.map((l) => l.nombre)).toEqual(["registrar_evento_webhook", "acreditar_cobro_debito"]);
  });
});

describe("función apagada (N1)", () => {
  it("con la función apagada el evento queda abierto: prendida después, el mismo aviso se acredita", async () => {
    const { db, llamadas } = base({ registrar_evento_webhook: { evento_id: "e1", procesado: false }, acreditar_cobro_debito: "funcion_apagada" });
    expect(await procesarCobroDebito(db, "g1", cobro())).toEqual({ resultado: "funcion_apagada" });
    expect(llamadas.map((l) => l.nombre)).toEqual(["registrar_evento_webhook", "acreditar_cobro_debito"]);
  });
});

describe("procesarAdhesionDebito (N1)", () => {
  it("la suscripción cambia de estado una vez por estado", async () => {
    const { db, llamadas } = base({ registrar_evento_webhook: { evento_id: "e2", procesado: false }, actualizar_adhesion_debito: "activa" });
    expect(await procesarAdhesionDebito(db, "g1", { suscripcionId: "sus-1", estado: "authorized" })).toEqual({ resultado: "activa" });
    expect(llamadas[0].args).toMatchObject({ p_id_externo: "sus-1:authorized", p_tipo: "debito_adhesion" });
  });
});
