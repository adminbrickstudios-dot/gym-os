import { describe, expect, it, vi } from "vitest";
import { memoriaCorta } from "./memoria";

describe("memoriaCorta", () => {
  it("pregunta una sola vez dentro del minuto y otra vez después", async () => {
    const m = memoriaCorta<string>(60_000);
    const buscar = vi.fn(async () => "demo");
    await m.obtener("a", buscar, 0);
    await m.obtener("a", buscar, 59_000);
    expect(buscar).toHaveBeenCalledTimes(1);
    await m.obtener("a", buscar, 61_000);
    expect(buscar).toHaveBeenCalledTimes(2);
  });
  it("no guarda un error", async () => {
    const m = memoriaCorta<string>(60_000);
    await expect(m.obtener("a", async () => { throw new Error("red"); }, 0)).rejects.toThrow("red");
    const buscar = vi.fn(async () => "ok");
    await m.obtener("a", buscar, 1);
    expect(buscar).toHaveBeenCalledTimes(1);
  });
  it("no recuerda un 'no existe'", async () => {
    const m = memoriaCorta<string | undefined>(60_000);
    const buscar = vi.fn(async () => undefined);
    await m.obtener("a", buscar, 0);
    await m.obtener("a", buscar, 1);
    expect(buscar).toHaveBeenCalledTimes(2);
  });
  it("direcciones distintas no se mezclan", async () => {
    const m = memoriaCorta<string>(60_000);
    expect(await m.obtener("a", async () => "A", 0)).toBe("A");
    expect(await m.obtener("b", async () => "B", 0)).toBe("B");
  });
});
