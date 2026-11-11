import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" }) }));
const rpc = vi.fn();
vi.mock("@/lib/supabase/servicio", () => ({ clienteServicio: () => ({ rpc }) }));

import { ESPERA_MINIMA_SEG, frenarEnvioPublico } from "./envio-publico";

const formulario = (campos: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(campos)) f.set(k, v); return f; };

describe("frenarEnvioPublico (D49)", () => {
  beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ error: null }); });

  it("campo trampa lleno: es un robot y no toca la base", async () => {
    expect(await frenarEnvioPublico(formulario({ sitio: "http://spam.invalid", segundos: "30" }), "alta_online", "1")).toEqual({ robot: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sin el contador o con menos de 3 segundos: error, y no cuenta para el tope", async () => {
    for (const segundos of [undefined, "", "0", String(ESPERA_MINIMA_SEG - 1), "abc"]) {
      const r = await frenarEnvioPublico(formulario(segundos === undefined ? {} : { segundos }), "consulta", "a@b.c");
      expect(r.error).toMatch(/muy rápido/);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("una persona (3 segundos o más) pasa por el tope de la base con la primera IP", async () => {
    expect(await frenarEnvioPublico(formulario({ segundos: "3" }), "alta_online", "30123456")).toEqual({});
    expect(rpc).toHaveBeenCalledWith("registrar_envio_publico", { p_formulario: "alta_online", p_ip: "203.0.113.9", p_clave: "30123456" });
  });

  it("si la base dice que se pasó del tope, devuelve su texto", async () => {
    rpc.mockResolvedValue({ error: { message: "Ya mandaste este formulario varias veces: esperá una hora y probá de nuevo." } });
    expect((await frenarEnvioPublico(formulario({ segundos: "10" }), "alta_online", "x")).error).toMatch(/varias veces/);
  });
});
