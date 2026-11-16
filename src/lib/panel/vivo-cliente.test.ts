import { beforeEach, describe, expect, it, vi } from "vitest";

const traer = vi.fn();
vi.mock("@/app/panel/vivo-acciones", () => ({ traerVivo: (c: unknown) => traer(c) }));

const ctx = { rol: "dueno", apagadas: [] as string[] };
const vivo = (mensajes: number) => ({ pendientes: { mensajes }, sinLeer: 0 });
const diferido = <T,>() => { let ok!: (v: T) => void; const p = new Promise<T>((r) => { ok = r; }); return { p, ok }; };

describe("pedirVivo: lo fresco no reusa lo viejo", () => {
  beforeEach(() => { vi.resetModules(); traer.mockReset(); });

  it("sin fresco, dos pedidos a la vez comparten uno solo", async () => {
    const { pedirVivo } = await import("./vivo-cliente");
    const d = diferido<unknown>(); traer.mockReturnValue(d.p);
    const a = pedirVivo(ctx), b = pedirVivo(ctx);
    expect(traer).toHaveBeenCalledTimes(1);
    d.ok(vivo(1)); expect(await a).toEqual(vivo(1)); expect(await b).toEqual(vivo(1));
  });

  it("con fresco, un pedido en vuelo no se reusa y gana el más nuevo (el menú no queda con el número de antes de contestar)", async () => {
    const { pedirVivo } = await import("./vivo-cliente");
    const viejo = diferido<unknown>(), nuevo = diferido<unknown>();
    traer.mockReturnValueOnce(viejo.p).mockReturnValueOnce(nuevo.p);
    const a = pedirVivo(ctx);          // sale antes de contestar: dice 1 mensaje
    const b = pedirVivo(ctx, true);    // contestó: pide fresco
    expect(traer).toHaveBeenCalledTimes(2);
    nuevo.ok(vivo(0)); expect(await b).toEqual(vivo(0));
    viejo.ok(vivo(1));                 // la respuesta vieja llega tarde: no pisa a la fresca
    expect(await a).toEqual(vivo(0));
  });

  it("con fresco, una respuesta guardada hace menos de 1,5 s tampoco se reusa", async () => {
    const { pedirVivo } = await import("./vivo-cliente");
    traer.mockResolvedValueOnce(vivo(1)).mockResolvedValueOnce(vivo(0));
    expect(await pedirVivo(ctx)).toEqual(vivo(1));
    expect(await pedirVivo(ctx)).toEqual(vivo(1));          // sin fresco: la guardada
    expect(await pedirVivo(ctx, true)).toEqual(vivo(0));    // fresco: pide de nuevo
    expect(traer).toHaveBeenCalledTimes(2);
  });
});
