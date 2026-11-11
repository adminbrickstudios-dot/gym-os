import { describe, expect, it } from "vitest";
import { leerConReintento } from "./lectura";

describe("leerConReintento", () => {
  it("devuelve el resultado si el primer pedido anda", async () => {
    expect(await leerConReintento(async () => 7, 3, 1)).toBe(7);
  });
  it("repite un pedido abortado y devuelve el que sale bien", async () => {
    let n = 0;
    const r = await leerConReintento(async () => { if (++n < 3) throw new Error("aborted"); return "listo"; }, 3, 1);
    expect(r).toBe("listo");
    expect(n).toBe(3);
  });
  it("si todos fallan, propaga el último error (no devuelve una lista vacía)", async () => {
    let n = 0;
    await expect(leerConReintento(async () => { n++; throw new Error(`falla ${n}`); }, 3, 1)).rejects.toThrow("falla 3");
  });
});
